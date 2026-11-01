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

type Settings = {
  xp: XpSettings;
  unt_structure: UntStructure;
  ai_limits: AiLimits;
  diagnostic: DiagnosticSettings;
};

const DEFAULTS: Settings = {
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
    return data ? ({ ...DEFAULTS[key], ...(data.value as object) } as Settings[K]) : DEFAULTS[key];
  } catch (error) {
    console.error(`getSetting(${key}) failed`, error);
    return DEFAULTS[key];
  }
});
