// app_settings мәндерін тексеру ережелері. Белгісіз қосымша өрістер сақталады (looseObject).

import { z } from "zod";

const int = (min = 0, max = 1_000_000) => z.number().int().min(min).max(max);

const untStructure = z
  .looseObject({
    year: int(2000, 2100),
    durationMinutes: int(10, 600),
    totalQuestions: int(1, 500),
    maxScore: int(1, 1000),
    sections: z
      .array(
        z.looseObject({
          subject: z.string().regex(/^[a-z_]+$/),
          questions: int(1, 200),
          maxPoints: int(1, 500),
          composition: z.looseObject({ single: int().optional(), context: int().optional(), multiple: int().optional() }),
        }),
      )
      .min(1),
    scoring: z.looseObject({
      single: z.number().min(0),
      context: z.number().min(0),
      multiple: z.looseObject({ maxPoints: z.number().min(0), byMistakes: z.array(z.number().min(0)).min(1) }),
    }),
  })
  .superRefine((s, ctx) => {
    const sum = s.sections.reduce((n, x) => n + x.questions, 0);
    if (sum !== s.totalQuestions) ctx.addIssue({ code: "custom", message: `Пәндердегі сұрақтар қосындысы (${sum}) totalQuestions-қа (${s.totalQuestions}) тең емес` });
    const points = s.sections.reduce((n, x) => n + x.maxPoints, 0);
    if (points !== s.maxScore) ctx.addIssue({ code: "custom", message: `Пәндердің maxPoints қосындысы (${points}) maxScore-ға (${s.maxScore}) тең емес` });
    for (const x of s.sections) {
      const c = (x.composition.single ?? 0) + (x.composition.context ?? 0) + (x.composition.multiple ?? 0);
      if (c !== x.questions) ctx.addIssue({ code: "custom", message: `${x.subject}: composition қосындысы (${c}) questions-қа (${x.questions}) тең емес` });
    }
    if (new Set(s.sections.map((x) => x.subject)).size !== s.sections.length) ctx.addIssue({ code: "custom", message: "Пән екі рет жазылған" });
  });

const levels = z
  .array(z.looseObject({ level: int(1, 1000), xp: int(), name_kk: z.string().min(1).max(60), name_ru: z.string().min(1).max(60) }))
  .min(1)
  .superRefine((list, ctx) => {
    if (list[0].xp !== 0) ctx.addIssue({ code: "custom", message: "Бірінші деңгейдің xp мәні 0 болуы керек" });
    for (let i = 1; i < list.length; i++) {
      if (list[i].level !== list[i - 1].level + 1 || list[i].xp <= list[i - 1].xp) {
        ctx.addIssue({ code: "custom", message: "Деңгейлер 1, 2, 3… ретімен, xp өсу ретімен болуы керек" });
        break;
      }
    }
  });

export const SETTING_SCHEMAS = {
  unt_structure: untStructure,
  diagnostic: z.looseObject({ durationMinutes: int(1, 240), perSubject: z.record(z.string().regex(/^[a-z_]+$/), int(0, 50)) }),
  ai_limits: z.looseObject({
    paidDailyExplanations: int(0, 1000),
    freeDailyExplanations: int(0, 1000),
    planRegenerationsPerWeek: int(0, 100),
    model: z.string().regex(/^claude-[a-z0-9.-]+$/),
  }),
  league: z
    .looseObject({ groupSize: int(5, 200), promote: int(0, 100), demote: int(0, 100) })
    .refine((l) => l.promote + l.demote < l.groupSize, "promote + demote groupSize-тан аз болуы керек"),
  xp: z.looseObject({
    lessonComplete: int(0, 10_000),
    questionCorrect: int(0, 10_000),
    mistakeFixed: int(0, 10_000),
    streakDay: int(0, 10_000),
    mockFinished: int(0, 10_000),
    diagnosticFinished: int(0, 10_000),
    streakFreezeCost: int(0, 100_000),
    quizPassPercent: int(1, 100),
  }),
  levels,
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;

export function isSettingKey(key: string): key is SettingKey {
  return key in SETTING_SCHEMAS;
}

/** JSON мәтінін талдап, тексеру. Қате болса — адамға түсінікті хабар. */
export function validateSetting(key: SettingKey, text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, message: `JSON қате: ${(e as Error).message}` };
  }
  const result = SETTING_SCHEMAS[key].safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, message: `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}` };
  }
  return { ok: true, value: result.data };
}
