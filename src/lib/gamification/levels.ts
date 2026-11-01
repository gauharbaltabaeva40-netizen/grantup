import type { LevelDef } from "@/lib/settings";

export type LevelInfo = {
  level: number;
  name: string;
  /** Келесі деңгейге дейінгі прогресс, % */
  progress: number;
  xpToNext: number | null;
};

/** Деңгей атауы және келесі деңгейге дейінгі прогресс (app_settings.levels бойынша). */
export function levelInfo(xp: number, level: number, levels: LevelDef[], locale: string): LevelInfo {
  const sorted = [...levels].sort((a, b) => a.level - b.level);
  const current = [...sorted].reverse().find((l) => l.level <= level) ?? sorted[0];
  const next = sorted.find((l) => l.level > level);
  const name = current ? (locale === "ru" ? current.name_ru : current.name_kk) : "";
  if (!next || !current) return { level, name, progress: 100, xpToNext: null };
  const span = Math.max(1, next.xp - current.xp);
  return {
    level,
    name,
    progress: Math.min(100, Math.max(0, Math.round(((xp - current.xp) / span) * 100))),
    xpToNext: Math.max(0, next.xp - xp),
  };
}

/**
 * Көрсетілетін серия: кеше немесе бүгін белсенді болса — сақталған мән;
 * бір күн өткізілсе және freeze болса — әлі сақталады; әйтпесе — 0.
 */
export function effectiveStreak(streak: number, lastActive: string | null, freezes: number, today: string): number {
  if (!lastActive || streak <= 0) return 0;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastActive}T00:00:00Z`)) / 86400_000);
  if (days <= 1) return streak;
  if (days === 2 && freezes > 0) return streak;
  return 0;
}
