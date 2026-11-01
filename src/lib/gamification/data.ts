import "server-only";
import { cache } from "react";
import { getCurrentProfile, getSessionUser } from "@/lib/auth/session";
import { localized } from "@/lib/content/localize";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { almatyToday } from "./xp";

// ---------------------------------------------------------------------
// Мерекелеу: деңгей көтерілді, серия ұзарды, жаңа жетістіктер
// ---------------------------------------------------------------------

export type CelebrationAchievement = { code: string; title: string; description: string; icon: string; xp: number };
export type Celebrations = {
  levelUp: { level: number; name: string } | null;
  streak: number | null;
  achievements: CelebrationAchievement[];
};

export const getCelebrations = cache(async (locale: string): Promise<Celebrations | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const today = almatyToday();
  const supabase = await createClient();
  const [{ data: unseen }, levels] = await Promise.all([
    supabase.from("user_achievements").select("achievement_code").eq("user_id", profile.id).is("seen_at", null),
    getSetting("levels"),
  ]);

  let achievements: CelebrationAchievement[] = [];
  if (unseen?.length) {
    const { data } = await supabase.from("achievements").select("*").in("code", unseen.map((u) => u.achievement_code));
    achievements = (data ?? []).map((a) => ({
      code: a.code,
      title: localized(a, "title", locale),
      description: localized(a, "description", locale),
      icon: a.icon,
      xp: a.xp_reward,
    }));
  }

  const levelDef = levels.find((l) => l.level === profile.level);
  const levelUp =
    profile.level > profile.celebrated_level
      ? { level: profile.level, name: levelDef ? (locale === "ru" ? levelDef.name_ru : levelDef.name_kk) : "" }
      : null;
  const streak =
    profile.last_active_date === today && profile.streak >= 2 && profile.celebrated_streak_date !== today ? profile.streak : null;

  if (!levelUp && !streak && achievements.length === 0) return null;
  return { levelUp, streak, achievements };
});

// ---------------------------------------------------------------------
// Апталық лига
// ---------------------------------------------------------------------

export type LeagueView = {
  tier: { tier: number; name: string; color: string };
  nextTier: { name: string; color: string } | null;
  maxTier: number;
  weekEndsAt: string;
  promote: number;
  demote: number;
  standings: { userId: string; name: string; avatar: string | null; weeklyXp: number; isMe: boolean; rank: number }[];
  myRank: number | null;
  lastWeek: { outcome: "promoted" | "demoted" | "stayed"; rank: number | null; tierName: string } | null;
};

export const getLeagueView = cache(async (locale: string): Promise<LeagueView | null> => {
  const [user, profile] = await Promise.all([getSessionUser(), getCurrentProfile()]);
  if (!user || !profile) return null;

  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: leagues }, { data: weekStart }, settings] = await Promise.all([
    supabase.from("leagues").select("*").order("tier"),
    admin.rpc("league_week_start", {}),
    getSetting("league"),
  ]);
  const week = weekStart as unknown as string;
  const tierOf = (n: number) => (leagues ?? []).find((l) => l.tier === n);

  const [{ data: membership }, { data: previous }] = await Promise.all([
    supabase.from("league_members").select("group_id").eq("user_id", user.id).eq("week_start", week).maybeSingle(),
    supabase
      .from("league_members")
      .select("outcome, final_rank, group_id, week_start")
      .eq("user_id", user.id)
      .lt("week_start", week)
      .not("outcome", "is", null)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let standings: LeagueView["standings"] = [];
  if (membership) {
    const { data } = await supabase.rpc("league_standings", { p_group: membership.group_id });
    standings = (data ?? []).map((s, i) => ({
      userId: s.user_id,
      name: s.display_name,
      avatar: s.avatar,
      weeklyXp: s.weekly_xp,
      isMe: s.is_me,
      rank: i + 1,
    }));
  }

  let lastWeek: LeagueView["lastWeek"] = null;
  if (previous?.outcome) {
    const { data: group } = await supabase.from("league_groups").select("tier").eq("id", previous.group_id).maybeSingle();
    const tier = group ? tierOf(group.tier) : null;
    lastWeek = { outcome: previous.outcome, rank: previous.final_rank, tierName: tier ? localized(tier, "name", locale) : "" };
  }

  const current = tierOf(profile.league_tier) ?? (leagues ?? [])[0];
  const next = tierOf(profile.league_tier + 1);
  // Келесі дүйсенбі 00:00 Asia/Almaty
  const weekEndsAt = new Date(new Date(`${week}T00:00:00+05:00`).getTime() + 7 * 86400_000).toISOString();

  return {
    tier: { tier: current?.tier ?? 1, name: current ? localized(current, "name", locale) : "", color: current?.color ?? "#B87333" },
    nextTier: next ? { name: localized(next, "name", locale), color: next.color } : null,
    maxTier: Math.max(...(leagues ?? []).map((l) => l.tier), 1),
    weekEndsAt,
    promote: settings.promote,
    demote: settings.demote,
    standings,
    myRank: standings.find((s) => s.isMe)?.rank ?? null,
    lastWeek,
  };
});

// ---------------------------------------------------------------------
// Жетістіктер (профиль үшін)
// ---------------------------------------------------------------------

export const getAchievements = cache(async (locale: string) => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const [{ data: all }, { data: mine }] = await Promise.all([
    supabase.from("achievements").select("*").order("position"),
    supabase.from("user_achievements").select("achievement_code, earned_at").eq("user_id", user.id),
  ]);
  return (all ?? []).map((a) => {
    const earned = (mine ?? []).find((m) => m.achievement_code === a.code);
    return {
      code: a.code,
      title: localized(a, "title", locale),
      description: localized(a, "description", locale),
      icon: a.icon,
      xp: a.xp_reward,
      earnedAt: earned?.earned_at ?? null,
    };
  });
});
