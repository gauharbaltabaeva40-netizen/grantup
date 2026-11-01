// Болжамды ҰБТ балы және «қай пәннен ұпай жинау оңай» кеңесі — таза функциялар (тестіленеді).

export type MockScore = { score: number; maxScore: number; finishedAt: string };
export type SubjectAccuracy = { subject: string; correct: number; total: number; maxPoints: number };

export type Prediction = {
  score: number;
  /** "mock" — сынақтар бар; "practice" — тек тест нәтижелерінен; бағалау сенімділігі үшін */
  basis: "mock" | "practice";
};

/** Сынақсыз болжау үшін ең аз жауап саны */
export const MIN_ANSWERS_FOR_PREDICTION = 20;
/** Пән бойынша дәлдікті сенімді деп санау үшін ең аз жауап саны */
const MIN_SUBJECT_ANSWERS = 5;

/** Пәндер бойынша дәлдіктен бағалау: Σ дәлдік × пәннің ең жоғары балы. Деректері аз пән — 50% деп алынады. */
export function accuracyEstimate(subjects: SubjectAccuracy[], maxScore: number): number | null {
  const total = subjects.reduce((s, x) => s + x.total, 0);
  if (total < MIN_ANSWERS_FOR_PREDICTION || subjects.length === 0) return null;
  const sum = subjects.reduce((s, x) => {
    const accuracy = x.total >= MIN_SUBJECT_ANSWERS ? x.correct / x.total : 0.5;
    return s + accuracy * x.maxPoints;
  }, 0);
  const configured = subjects.reduce((s, x) => s + x.maxPoints, 0);
  // Конфигте барлық пән болмаса, ресми ең жоғары балға масштабтаймыз
  return configured > 0 ? (sum / configured) * maxScore : null;
}

/**
 * Болжамды балл:
 * - соңғы 3 сынақ (жаңасы ауыр: 0.5 / 0.3 / 0.2), әрқайсысы ресми ең жоғары балға масштабталады;
 * - тест нәтижелерінен бағалау бар болса — 70% сынақ + 30% тест;
 * - сынақ жоқ болса — тек тест нәтижесінен (жеткілікті жауап болса).
 */
export function predictScore(mocks: MockScore[], subjects: SubjectAccuracy[], maxScore: number): Prediction | null {
  const fromPractice = accuracyEstimate(subjects, maxScore);
  const recent = [...mocks]
    .filter((m) => m.maxScore > 0)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
    .slice(0, 3);

  if (recent.length === 0) {
    return fromPractice === null ? null : { score: clamp(Math.round(fromPractice), maxScore), basis: "practice" };
  }

  const weights = [0.5, 0.3, 0.2].slice(0, recent.length);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const fromMocks = recent.reduce((s, m, i) => s + (m.score / m.maxScore) * maxScore * weights[i], 0) / weightSum;
  const blended = fromPractice === null ? fromMocks : fromMocks * 0.7 + fromPractice * 0.3;
  return { score: clamp(Math.round(blended), maxScore), basis: "mock" };
}

/** Ең көп балл қосуға мүмкіндік беретін пән: (1 − дәлдік) × пәннің ең жоғары балы. */
export function easiestGain(subjects: SubjectAccuracy[]): { subject: string; gain: number } | null {
  const candidates = subjects
    .filter((s) => s.total >= MIN_SUBJECT_ANSWERS)
    .map((s) => ({ subject: s.subject, gain: Math.round((1 - s.correct / s.total) * s.maxPoints * 0.5) }))
    .filter((s) => s.gain > 0)
    .sort((a, b) => b.gain - a.gain);
  return candidates[0] ?? null;
}

function clamp(value: number, max: number) {
  return Math.min(max, Math.max(0, value));
}
