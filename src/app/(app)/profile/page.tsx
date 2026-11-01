import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Award, ChevronRight, Lock, LogOut, Monitor, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { StreakFreezeCard } from "@/components/gamification/streak-freeze-card";
import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";
import { FadeIn } from "@/components/motion/fade-in";
import { GoalForm, NotificationsForm, ProfileForm } from "@/components/profile/profile-editors";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccess } from "@/lib/access";
import { signOut } from "@/lib/auth/actions";
import { getCurrentDeviceId, getCurrentProfile } from "@/lib/auth/session";
import { localized } from "@/lib/content/localize";
import { getAchievements } from "@/lib/gamification/data";
import { getGrantOverview } from "@/lib/grant/data";
import { getMockOverview } from "@/lib/mock/data";
import { getSetting } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getViewer } from "@/lib/viewer";

export const generateMetadata = () => placeholderMetadata("profile");

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 rounded-2xl shadow-soft ring-0">
      <CardHeader>
        <CardTitle className="text-base font-bold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function ProfilePage() {
  const [viewer, profile] = await Promise.all([getViewer(), getCurrentProfile()]);
  if (!viewer || viewer.demo || !profile) return <PlaceholderPage section="profile" icon={UserRound} />;

  const locale = await getLocale();
  const supabase = await createClient();
  const [t, tp, te, ta, tauth, tach, tm, format, access, currentDeviceId, achievements, xpSettings, grant, mocks] = await Promise.all([
    getTranslations("profile"),
    getTranslations("profileExtra"),
    getTranslations("profileEdit"),
    getTranslations("access"),
    getTranslations("auth"),
    getTranslations("achievements"),
    getTranslations("mockExam"),
    getFormatter(),
    getAccess(),
    getCurrentDeviceId(),
    getAchievements(locale),
    getSetting("xp"),
    getGrantOverview(locale),
    getMockOverview(locale),
  ]);

  const [{ data: devices }, { data: specialties }, { data: notifications }, { count: lessonsDone }] = await Promise.all([
    supabase.from("devices").select("id, label, last_seen_at, last_city").eq("user_id", profile.id).is("revoked_at", null).order("last_seen_at", { ascending: false }),
    supabase.from("specialties").select("id, code, name_kk, name_ru, threshold_score").eq("is_active", true).order("threshold_score", { ascending: false }),
    supabase.from("notifications_settings").select("*").eq("user_id", profile.id).maybeSingle(),
    supabase.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", profile.id).not("completed_at", "is", null),
  ]);

  const date = (value: string | number) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const earnedCount = achievements.filter((a) => a.earnedAt).length;
  const stats = [
    { label: te("statAnswered"), value: grant?.stats.answered ?? 0 },
    { label: te("statAccuracy"), value: grant?.stats.answered ? `${Math.round((grant.stats.correct / grant.stats.answered) * 100)}%` : "—" },
    { label: te("statLessons"), value: lessonsDone ?? 0 },
    { label: te("statMocks"), value: grant?.stats.mocks ?? 0 },
    { label: te("statBest"), value: grant?.stats.bestMock ?? "—" },
    { label: te("statLongest"), value: profile.longest_streak },
  ];

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-5">
      {/* Тақырып: аватар, аты, деңгей */}
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-gradient text-3xl text-white shadow-brand" aria-hidden>
          {profile.avatar ?? viewer.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{viewer.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{viewer.email}</p>
          <p className="text-sm font-semibold text-primary">
            {viewer.level.level} · {viewer.level.name} · {viewer.xp} XP
          </p>
        </div>
      </div>

      <Card className="rounded-2xl shadow-soft ring-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{tp("access")}:</span>
            <Badge variant={access.tier === "full" ? "default" : "secondary"} className="h-7 px-3 text-sm">
              {access.tier === "full" ? ta("full") : ta("free")}
            </Badge>
            {access.tier === "full" && (
              // ends_at — соңғы күннен кейінгі күннің басы; адамға соңғы күнді көрсетеміз
              <span className="text-sm text-muted-foreground">{ta("until", { date: date(new Date(access.endsAt).getTime() - 1) })}</span>
            )}
          </div>
          {access.tier === "free" && (
            <Link href="/upgrade" className={buttonVariants({ variant: "brand", size: "lg" })}>
              {tp("upgrade")}
              <ChevronRight aria-hidden />
            </Link>
          )}
        </CardContent>
      </Card>

      <Section title={te("stats")}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-0.5 text-xl font-extrabold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="goal" title={te("goal")}>
        <GoalForm
          targetScore={profile.target_score}
          specialtyId={profile.target_specialty_id}
          specialties={(specialties ?? []).map((s) => ({ id: s.id, code: s.code, name: localized(s, "name", locale), threshold: s.threshold_score }))}
        />
      </Section>

      <Section title={tach("title")} description={tach("earned", { count: earnedCount, total: achievements.length })}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {achievements.map((a) => (
            <li
              key={a.code}
              title={a.description}
              className={cn("flex items-center gap-2.5 rounded-xl p-2.5", a.earnedAt ? "bg-secondary" : "bg-muted/60 opacity-60")}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", a.earnedAt ? "bg-brand-gradient text-white" : "bg-muted text-muted-foreground")}>
                {a.earnedAt ? <Award className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{a.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{a.earnedAt ? a.description : tach("locked")}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <StreakFreezeCard freezes={viewer.streakFreezes} xp={viewer.xp} cost={xpSettings.streakFreezeCost} />

      <Section title={te("history")}>
        {mocks?.history.length ? (
          <ul className="divide-y">
            {mocks.history.slice(0, 5).map((h) => (
              <li key={h.attemptId}>
                <Link href={`/mock-exam/${h.attemptId}/result`} className="flex items-center gap-3 py-2.5 outline-none hover:text-primary focus-visible:text-primary">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{h.title}</span>
                    <span className="text-xs text-muted-foreground">{date(h.finishedAt)}</span>
                  </span>
                  <span className="font-extrabold tabular-nums">{tm("score", { score: h.score, max: h.maxScore })}</span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{te("historyEmpty")}</p>
        )}
      </Section>

      <Section title={te("title")}>
        <ProfileForm fullName={profile.full_name} nickname={profile.nickname} avatar={profile.avatar} grade={profile.grade} />
        <p className="mt-4 text-xs text-muted-foreground">{te("appearance")}</p>
      </Section>

      {notifications && (
        <Section title={te("notifications")} description={te("notificationsHint")}>
          <NotificationsForm
            initial={{
              push_streak: notifications.push_streak,
              push_league: notifications.push_league,
              push_weekly: notifications.push_weekly,
              email_weekly: notifications.email_weekly,
              email_access_expiry: notifications.email_access_expiry,
            }}
          />
        </Section>
      )}

      <Section title={tp("devicesTitle")} description={tp("devicesHint")}>
        <ul className="divide-y">
          {(devices ?? []).map((d) => {
            const Icon = /iPhone|Android/.test(d.label) ? Smartphone : Monitor;
            return (
              <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                  <Icon className="size-5 text-muted-foreground" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tp("lastSeen", { date: date(d.last_seen_at) })}
                    {d.last_city ? ` · ${d.last_city}` : ""}
                  </p>
                </div>
                {d.id === currentDeviceId && <Badge variant="secondary">{tp("thisDevice")}</Badge>}
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row">
        {viewer.role === "admin" && (
          <Link href="/admin/devices" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "sm:flex-1")}>
            <ShieldCheck aria-hidden />
            {tp("adminPanel")}
          </Link>
        )}
        <form action={signOut} className="sm:flex-1">
          <Button type="submit" variant="destructive" size="xl" className="w-full">
            <LogOut aria-hidden />
            {tauth("logout")}
          </Button>
        </form>
      </div>

      <p className="sr-only">{t("description")}</p>
    </FadeIn>
  );
}
