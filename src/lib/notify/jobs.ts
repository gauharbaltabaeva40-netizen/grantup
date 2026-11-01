import "server-only";
import { almatyToday } from "@/lib/gamification/xp";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationsSettings } from "@/lib/supabase/types";
import { emailLayout, emailToUser, notifyT, pushToUser } from "./send";

/**
 * Жоспарлы хабарламалар (Vercel Cron шақырады):
 * - күн сайын 20:00 Asia/Almaty: streak ескертуі, лигадағы аймақ өзгерісі, доступ мерзімі бітуге 3 күн қалғаны;
 * - дүйсенбі 00:00: апта қорытындысы (push) және апталық есеп (email).
 * Әр оқушы өз баптауларында хабарлама түрін өшіре алады; бір хабарлама екі рет жіберілмейді (notification_log).
 */

type Summary = Record<string, number>;
const PAGE = 1000;

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function settingsFor(userIds: string[]) {
  if (!userIds.length) return new Map<string, NotificationsSettings>();
  const { data } = await createAdminClient().from("notifications_settings").select("*").in("user_id", userIds);
  return new Map((data ?? []).map((s) => [s.user_id, s]));
}

async function profilesFor(userIds: string[]) {
  if (!userIds.length) return new Map<string, { email: string; locale: string; name: string; streak: number; league_tier: number }>();
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, email, locale, full_name, nickname, streak, league_tier")
    .in("id", userIds);
  return new Map(
    (data ?? []).map((p) => [
      p.id,
      { email: p.email, locale: p.locale, name: p.nickname || p.full_name.split(" ")[0] || "", streak: p.streak, league_tier: p.league_tier },
    ]),
  );
}

async function leagueNames() {
  const { data } = await createAdminClient().from("leagues").select("tier, name_kk, name_ru");
  return (tier: number, locale: string) => {
    const l = (data ?? []).find((x) => x.tier === tier);
    return l ? (locale === "ru" ? l.name_ru : l.name_kk) : "";
  };
}

// ---------------------------------------------------------------------
// 1. Streak ескертуі: кеше белсенді болған, бүгін әлі оқымаған оқушылар
// ---------------------------------------------------------------------
async function streakReminders(today: string, summary: Summary) {
  const admin = createAdminClient();
  const yesterday = addDays(today, -1);
  for (let from = 0; ; from += PAGE) {
    const { data: rows } = await admin
      .from("profiles")
      .select("id, locale, streak")
      .eq("last_active_date", yesterday)
      .gte("streak", 1)
      .range(from, from + PAGE - 1);
    if (!rows?.length) break;
    const settings = await settingsFor(rows.map((r) => r.id));
    for (const row of rows) {
      if (settings.get(row.id)?.push_streak === false) continue;
      const t = notifyT(row.locale);
      const n = await pushToUser(row.id, "push_streak", today, {
        title: t("streakTitle"),
        body: t("streakBody", { count: row.streak }),
        url: "/",
        tag: "streak",
        lang: row.locale,
      });
      if (n) summary.streak = (summary.streak ?? 0) + 1;
    }
    if (rows.length < PAGE) break;
  }
}

// ---------------------------------------------------------------------
// 2. Лига: көтерілу немесе төмендеу аймағына жаңа кірген оқушыларға хабар
// ---------------------------------------------------------------------
async function leagueZones(summary: Summary) {
  const admin = createAdminClient();
  const [{ data: week }, league, nameOf, { data: leagues }] = await Promise.all([
    admin.rpc("league_week_start", {}),
    getSetting("league"),
    leagueNames(),
    admin.from("leagues").select("tier"),
  ]);
  const maxTier = Math.max(...(leagues ?? []).map((l) => l.tier), 1);
  const { data: groups } = await admin
    .from("league_groups")
    .select("id, tier")
    .eq("week_start", week as unknown as string)
    .is("closed_at", null);

  for (const group of groups ?? []) {
    const { data: members } = await admin
      .from("league_members")
      .select("user_id, weekly_xp, joined_at, notified_zone")
      .eq("group_id", group.id)
      .order("weekly_xp", { ascending: false })
      .order("joined_at", { ascending: true });
    if (!members?.length) continue;
    const n = members.length;
    const demoteFrom = Math.max(n - league.demote, league.promote);
    const [settings, profiles] = await Promise.all([settingsFor(members.map((m) => m.user_id)), profilesFor(members.map((m) => m.user_id))]);

    for (const [i, m] of members.entries()) {
      const rank = i + 1;
      const zone = rank <= league.promote && group.tier < maxTier ? "up" : rank > demoteFrom && group.tier > 1 ? "down" : "mid";
      if (zone === m.notified_zone) continue;
      await admin.from("league_members").update({ notified_zone: zone }).eq("group_id", group.id).eq("user_id", m.user_id);
      if (zone === "mid" || settings.get(m.user_id)?.push_league === false) continue;

      const p = profiles.get(m.user_id);
      const t = notifyT(p?.locale ?? "kk");
      const params = { rank, league: nameOf(group.tier, p?.locale ?? "kk") };
      const sent = await pushToUser(m.user_id, "push_league_zone", `${week}:${rank}:${zone}`, {
        title: t(zone === "up" ? "zoneUpTitle" : "zoneDownTitle"),
        body: t(zone === "up" ? "zoneUpBody" : "zoneDownBody", params),
        url: "/league",
        tag: "league",
        lang: p?.locale,
      });
      if (sent) summary.leagueZone = (summary.leagueZone ?? 0) + 1;
    }
  }
}

// ---------------------------------------------------------------------
// 3. Доступ мерзімі бітуге 3 күн қалды (email)
// ---------------------------------------------------------------------
async function accessExpiry(summary: Summary) {
  const admin = createAdminClient();
  const from = new Date(Date.now() + 2 * 86400_000).toISOString();
  const to = new Date(Date.now() + 3 * 86400_000).toISOString();
  const { data: grants } = await admin
    .from("access_grants")
    .select("id, user_id, ends_at")
    .is("revoked_at", null)
    .not("user_id", "is", null)
    .gt("ends_at", from)
    .lte("ends_at", to);
  if (!grants?.length) return;

  const userIds = grants.map((g) => g.user_id!);
  const [settings, profiles] = await Promise.all([settingsFor(userIds), profilesFor(userIds)]);
  for (const grant of grants) {
    const p = profiles.get(grant.user_id!);
    if (!p || settings.get(grant.user_id!)?.email_access_expiry === false) continue;
    // Оқушының одан кейін жалғасатын басқа гранты болса — ескертпейміз
    const { count } = await admin
      .from("access_grants")
      .select("id", { count: "exact", head: true })
      .eq("user_id", grant.user_id!)
      .is("revoked_at", null)
      .gt("ends_at", grant.ends_at);
    if (count) continue;

    const t = notifyT(p.locale);
    const lastDay = new Intl.DateTimeFormat(p.locale === "ru" ? "ru-RU" : "kk-KZ", { dateStyle: "long", timeZone: "Asia/Almaty" }).format(
      new Date(new Date(grant.ends_at).getTime() - 1),
    );
    const ok = await emailToUser(grant.user_id!, "email_access_expiry", grant.id, {
      to: p.email,
      subject: t("emailExpirySubject"),
      html: emailLayout({
        title: t("emailExpirySubject"),
        intro: t("emailExpiryText", { date: lastDay }),
        cta: { label: t("emailCta"), path: "/" },
        footer: t("emailFooter"),
      }),
    });
    if (ok) summary.accessExpiry = (summary.accessExpiry ?? 0) + 1;
  }
}

export async function runDailyJobs(): Promise<Summary> {
  const summary: Summary = {};
  const today = almatyToday();
  await streakReminders(today, summary);
  await leagueZones(summary);
  await accessExpiry(summary);
  return summary;
}

// ---------------------------------------------------------------------
// Апталық: лига қорытындысы (push) және есеп (email). Апта жабылғаннан кейін шақырылады.
// ---------------------------------------------------------------------
export async function runWeeklyJobs(week: string): Promise<Summary> {
  const summary: Summary = {};
  const admin = createAdminClient();
  const nameOf = await leagueNames();
  const weekStartIso = new Date(`${week}T00:00:00+05:00`).toISOString();
  const weekEndIso = new Date(new Date(weekStartIso).getTime() + 7 * 86400_000).toISOString();

  for (let from = 0; ; from += PAGE) {
    const { data: members } = await admin
      .from("league_members")
      .select("user_id, weekly_xp, final_rank, outcome")
      .eq("week_start", week)
      .not("outcome", "is", null)
      .range(from, from + PAGE - 1);
    if (!members?.length) break;

    const ids = members.map((m) => m.user_id);
    const [settings, profiles] = await Promise.all([settingsFor(ids), profilesFor(ids)]);

    for (const m of members) {
      const p = profiles.get(m.user_id);
      if (!p) continue;
      const s = settings.get(m.user_id);
      const t = notifyT(p.locale);
      const league = nameOf(p.league_tier, p.locale);
      const params = { rank: m.final_rank ?? 0, league, xp: m.weekly_xp };

      if (s?.push_weekly !== false) {
        const key = m.outcome === "promoted" ? "weekPromoted" : m.outcome === "demoted" ? "weekDemoted" : "weekStayed";
        const sent = await pushToUser(m.user_id, "push_week", week, {
          title: t(`${key}Title`),
          body: t(`${key}Body`, params),
          url: "/league",
          tag: "week",
          lang: p.locale,
        });
        if (sent) summary.weekPush = (summary.weekPush ?? 0) + 1;
      }

      if (s?.email_weekly !== false) {
        const [{ count: questions }, { count: lessons }, { data: plan }] = await Promise.all([
          admin
            .from("attempt_answers")
            .select("question_id", { count: "exact", head: true })
            .eq("user_id", m.user_id)
            .gte("answered_at", weekStartIso)
            .lt("answered_at", weekEndIso),
          admin
            .from("lesson_progress")
            .select("lesson_id", { count: "exact", head: true })
            .eq("user_id", m.user_id)
            .gte("completed_at", weekStartIso)
            .lt("completed_at", weekEndIso),
          admin.from("attempts").select("score, max_score").eq("user_id", m.user_id).eq("kind", "mock").in("status", ["finished", "expired"]).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        const rows: [string, string][] = [
          [t("emailXp"), String(m.weekly_xp)],
          [t("emailQuestions"), String(questions ?? 0)],
          [t("emailLessons"), String(lessons ?? 0)],
          [t("emailStreak"), String(p.streak)],
          [t("emailLeague"), `${league} · #${m.final_rank ?? "—"}`],
        ];
        if (plan?.max_score) rows.push([t("emailPredicted"), `${Math.round((Number(plan.score) / Number(plan.max_score)) * 140)} / 140`]);

        const ok = await emailToUser(m.user_id, "email_weekly", week, {
          to: p.email,
          subject: t("emailWeeklySubject"),
          html: emailLayout({
            title: t("emailWeeklyHello", { name: p.name }),
            intro: t("emailWeeklyIntro"),
            rows,
            cta: { label: t("emailCta"), path: "/" },
            footer: t("emailFooter"),
          }),
        });
        if (ok) summary.weekEmail = (summary.weekEmail ?? 0) + 1;
      }
    }
    if (members.length < PAGE) break;
  }
  return summary;
}
