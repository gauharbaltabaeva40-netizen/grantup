// Жауапты бағалау — таза функциялар (серверде де, тестте де қолданылады).
// Ережелер app_settings.unt_structure.scoring-тен келеді, сондықтан ҰБТ форматы өзгерсе — кодты өзгертпейміз.

export type ScoringRules = {
  single: number;
  context: number;
  multiple: { maxPoints: number; byMistakes: number[] };
};

export const DEFAULT_SCORING: ScoringRules = {
  single: 1,
  context: 1,
  multiple: { maxPoints: 2, byMistakes: [2, 1] },
};

export type GradeResult = {
  isCorrect: boolean;
  points: number;
  maxPoints: number;
  mistakes: number;
};

/**
 * - single / context: дәл бір дұрыс нұсқа таңдалса — толық балл, әйтпесе 0.
 * - multiple: «қате» = артық таңдалған нұсқа + таңдалмай қалған дұрыс нұсқа.
 *   byMistakes[қате саны] — балл (ҰБТ-2026: 0 қате → 2, 1 қате → 1, одан көп → 0).
 *   Ештеңе таңдалмаса — 0.
 */
export function gradeAnswer(
  kind: "single" | "context" | "multiple",
  correctIds: string[],
  selectedIds: string[],
  rules: ScoringRules = DEFAULT_SCORING,
): GradeResult {
  const correct = new Set(correctIds);
  const selected = new Set(selectedIds);
  const extra = [...selected].filter((id) => !correct.has(id)).length;
  const missed = [...correct].filter((id) => !selected.has(id)).length;
  const mistakes = extra + missed;

  if (kind === "multiple") {
    const maxPoints = rules.multiple.maxPoints;
    const points = selected.size === 0 ? 0 : (rules.multiple.byMistakes[mistakes] ?? 0);
    return { isCorrect: mistakes === 0, points, maxPoints, mistakes };
  }

  const maxPoints = kind === "context" ? rules.context : rules.single;
  const isCorrect = selected.size === 1 && mistakes === 0;
  return { isCorrect, points: isCorrect ? maxPoints : 0, maxPoints, mistakes };
}

/** Fisher–Yates, кездейсоқ сандар генераторы сырттан беріледі (серверде crypto). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Сынақ/диагностика «шынымен тапсырылды ма»: сұрақтардың кемінде жартысына жауап берілсе ғана XP мен
 * жетістік беріледі (бос аяқтап, марапат жинауға болмайды). Дерекқордағы attempt_is_engaged() — дәл осы ереже.
 */
export function isEngaged(answered: number, total: number): boolean {
  return total > 0 && answered * 2 >= total;
}
