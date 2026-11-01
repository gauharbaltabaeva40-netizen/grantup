import "server-only";
import { cache } from "react";
import { getLocale } from "next-intl/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { demoStudent } from "@/lib/demo";
import { isSupabaseConfigured } from "@/lib/env";
import { effectiveStreak, levelInfo, type LevelInfo } from "@/lib/gamification/levels";
import { almatyToday } from "@/lib/gamification/xp";
import { getSetting } from "@/lib/settings";

export type Viewer = {
  name: string;
  email: string;
  role: "student" | "admin";
  xp: number;
  level: LevelInfo;
  streak: number;
  streakFreezes: number;
  leagueTier: number;
  targetScore: number | null;
  demo: boolean;
};

/** Интерфейске қажетті пайдаланушы деректері. Демо режимде (кілттер жоқ) — макет деректер. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const [locale, levels] = await Promise.all([getLocale(), getSetting("levels")]);

  if (!isSupabaseConfigured) {
    return {
      name: demoStudent.name,
      email: "demo@grantup.kz",
      role: "student",
      xp: demoStudent.xp,
      level: levelInfo(demoStudent.xp, demoStudent.level, levels, locale),
      streak: demoStudent.streak,
      streakFreezes: 1,
      leagueTier: 1,
      targetScore: demoStudent.targetScore,
      demo: true,
    };
  }

  const profile = await getCurrentProfile();
  if (!profile) return null;

  return {
    name: profile.nickname || profile.full_name.split(" ")[0] || profile.email.split("@")[0],
    email: profile.email,
    role: profile.role,
    xp: profile.xp,
    level: levelInfo(profile.xp, profile.level, levels, locale),
    streak: effectiveStreak(profile.streak, profile.last_active_date, profile.streak_freezes, almatyToday()),
    streakFreezes: profile.streak_freezes,
    leagueTier: profile.league_tier,
    targetScore: profile.target_score,
    demo: false,
  };
});
