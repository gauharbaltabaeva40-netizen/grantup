import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_SCORING, type ScoringRules } from "@/lib/quiz/grading";
import { createAdminClient } from "@/lib/supabase/admin";

// app_settings-тегі конфиг (админ өзгертеді). Дерекқор қолжетімсіз болса — әдепкі мәндер.

export type XpSettings = {
  lessonComplete: number;
  questionCorrect: number;
  mistakeFixed: number;
  streakDay: number;
  mockFinished: number;
  diagnosticFinished: number;
  streakFreezeCost: number;
  quizPassPercent: number;
};

export type UntSection = {
  subject: string;
  questions: number;
  maxPoints: number;
  composition: Partial<Record<"single" | "context" | "multiple", number>>;
};

export type UntStructure = {
  year: number;
  durationMinutes: number;
  totalQuestions: number;
  maxScore: number;
  sections: UntSection[];
  scoring: ScoringRules;
};

export type AiLimits = {
  paidDailyExplanations: number;
  freeDailyExplanations: number;
  planRegenerationsPerWeek: number;
  model: string;
};

export type DiagnosticSettings = {
  durationMinutes: number;
  perSubject: Record<string, number>;
};

export type LevelDef = { level: number; xp: number; name_kk: string; name_ru: string };

export type LeagueSettings = { groupSize: number; promote: number; demote: number };

type Settings = {
  levels: LevelDef[];
  league: LeagueSettings;
  xp: XpSettings;
  unt_structure: UntStructure;
  ai_limits: AiLimits;
  diagnostic: DiagnosticSettings;
};

const DEFAULTS: Settings = {
  levels: [
    { level: 1, xp: 0, name_kk: "Бастаушы", name_ru: "Новичок" },
    { level: 2, xp: 100, name_kk: "Ізденуші", name_ru: "Искатель" },
    { level: 3, xp: 300, name_kk: "Талапкер", name_ru: "Абитуриент" },
  ],
  league: { groupSize: 30, promote: 7, demote: 5 },
  xp: {
    lessonComplete: 20,
    questionCorrect: 2,
    mistakeFixed: 5,
    streakDay: 10,
    mockFinished: 50,
    diagnosticFinished: 30,
    streakFreezeCost: 200,
    quizPassPercent: 70,
  },
  unt_structure: {
    year: 2026,
    durationMinutes: 240,
    totalQuestions: 120,
    maxScore: 140,
    sections: [],
    scoring: DEFAULT_SCORING,
  },
  ai_limits: {
    paidDailyExplanations: 30,
    freeDailyExplanations: 3,
    planRegenerationsPerWeek: 3,
    model: "claude-opus-5-5",
  },
  diagnostic: {
    durationMinutes: 20,
    perSubject: { history_kz: 4, reading_literacy: 3, math_literacy: 3, math: 5, informatics: 5 },
  },
};

export const getSetting = cache(async <K extends keyof Settings>(key: K): Promise<Settings[K]> => {
  if (!isSupabaseConfigured) return DEFAULTS[key];
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", key).maybeSingle();
    if (!data) return DEFAULTS[key];
    // Массив конфигтер (деңгейлер) тұтас ауыстырылады, объектілер әдепкі мәндермен біріктіріледі
    return (Array.isArray(data.value) ? data.value : { ...DEFAULTS[key], ...(data.value as object) }) as Settings[K];
  } catch (error) {
    console.error(`getSetting(${key}) failed`, error);
    return DEFAULTS[key];
  }
});
