// Excel/CSV-тен сұрақ импорттау: жолдарды талдау және тексеру.
// Клиент алдын ала қарау үшін, сервер қайта тексеру үшін қолданады (бір ереже — екі жақта).

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export const TEMPLATE_HEADERS = ["subject", "topic", "locale", "type", "difficulty", "stem", ...OPTION_LETTERS, "correct", "explanation"];

export type ImportRow = {
  subject: string;
  topic: string | null;
  locale: "kk" | "ru";
  type: "single" | "multiple";
  difficulty: 1 | 2 | 3;
  stem: string;
  options: string[];
  /** 0-ден басталатын дұрыс нұсқа индекстері */
  correct: number[];
  explanation: string;
};

// Тақырып атаулары қазақша/орысша да болуы мүмкін
const ALIASES: Record<string, string> = {
  пән: "subject",
  предмет: "subject",
  тақырып: "topic",
  тема: "topic",
  тіл: "locale",
  язык: "locale",
  түрі: "type",
  тип: "type",
  қиындық: "difficulty",
  сложность: "difficulty",
  сұрақ: "stem",
  вопрос: "stem",
  question: "stem",
  дұрыс: "correct",
  правильный: "correct",
  answer: "correct",
  түсіндірме: "explanation",
  объяснение: "explanation",
};

function normalizeKey(key: string) {
  const k = key.trim().toLowerCase();
  if (ALIASES[k]) return ALIASES[k];
  const option = /^(?:option|нұсқа|вариант)[ _]?(\d)$/.exec(k);
  if (option) return OPTION_LETTERS[Number(option[1]) - 1] ?? k;
  if (/^[a-h]$/.test(k)) return k.toUpperCase();
  return k;
}

const cell = (v: unknown) => (v == null ? "" : String(v).trim());

/** «A», «A, C», «1;3», «ac» → [0, 2]. Қате болса null. */
export function parseCorrect(value: string, optionCount: number): number[] | null {
  const v = value.trim().toUpperCase();
  if (!v) return null;
  const parts = /^[A-H]+$/.test(v) ? v.split("") : v.split(/[\s,;/]+/).filter(Boolean);
  const indexes = parts.map((p) => (/^[A-H]$/.test(p) ? OPTION_LETTERS.indexOf(p as (typeof OPTION_LETTERS)[number]) : /^\d$/.test(p) ? Number(p) - 1 : -1));
  if (indexes.some((i) => i < 0 || i >= optionCount)) return null;
  return [...new Set(indexes)].sort((a, b) => a - b);
}

/**
 * Бір жолды тексеру. subjects — рұқсат етілген пән кодтары.
 * Бос жол (сұрақ мәтіні мен нұсқалар жоқ) — null (өткізіледі).
 */
export function normalizeImportRow(raw: Record<string, unknown>, subjects: string[]): { row: ImportRow | null; errors: string[] } | null {
  const r: Record<string, string> = { subject: "", topic: "", locale: "", type: "", difficulty: "", stem: "", correct: "", explanation: "" };
  for (const [key, value] of Object.entries(raw)) r[normalizeKey(key)] = cell(value);
  if (!r.stem && OPTION_LETTERS.every((l) => !r[l])) return null;

  const errors: string[] = [];
  const subject = r.subject.toLowerCase();
  if (!subjects.includes(subject)) errors.push(`Пән коды белгісіз: «${r.subject}»`);

  const locale = (r.locale || "kk").toLowerCase();
  if (locale !== "kk" && locale !== "ru") errors.push("Тіл: kk немесе ru");

  // Нұсқалар қатарынан жазылуы керек (A, B, C ... аралықта бос орын болмасын)
  const options: string[] = [];
  let gap = false;
  for (const letter of OPTION_LETTERS) {
    if (r[letter]) {
      if (gap) errors.push("Нұсқалар арасында бос баған бар");
      options.push(r[letter]);
    } else gap = true;
  }
  if (options.length < 2) errors.push("Кемінде 2 нұсқа керек");
  if (!r.stem) errors.push("Сұрақ мәтіні бос");
  if (r.stem.length > 10_000 || options.some((o) => o.length > 2000) || r.explanation.length > 10_000) errors.push("Мәтін тым ұзын");

  const correct = parseCorrect(r.correct, options.length);
  if (!correct?.length) errors.push("Дұрыс жауап қате (мысалы: A немесе A,C)");

  const typeRaw = (r.type || "").toLowerCase();
  const type = typeRaw === "multiple" || typeRaw === "көп" ? "multiple" : typeRaw === "single" || typeRaw === "бір" ? "single" : typeRaw ? null : correct && correct.length > 1 ? "multiple" : "single";
  if (!type) errors.push("Түрі: single немесе multiple");
  if (type === "single" && correct && correct.length !== 1) errors.push("single сұрақта дәл 1 дұрыс жауап болады");

  const difficulty = r.difficulty ? Number(r.difficulty) : 2;
  if (![1, 2, 3].includes(difficulty)) errors.push("Қиындық: 1, 2 немесе 3");

  if (errors.length) return { row: null, errors };
  return {
    row: {
      subject,
      topic: r.topic || null,
      locale: locale as "kk" | "ru",
      type: type as "single" | "multiple",
      difficulty: difficulty as 1 | 2 | 3,
      stem: r.stem,
      options,
      correct: correct as number[],
      explanation: r.explanation,
    },
    errors: [],
  };
}
