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

type Settings = {
  xp: XpSettings;
  unt_structure: UntStructure;
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
