// Мәтіннен сұрақ импорттау: Word/PDF-тен көшірілген тестті сұрақтарға бөлу (таза функция — тестіленеді).
//
// Қолдайтын пішім (ҰБТ сынама тесттеріндегідей):
//   1. Сұрақ мәтіні (бірнеше жол болуы мүмкін; ішінде «1. 2. 3.» тізімі де болады)
//   A) нұсқа      B) нұсқа  …  (A–H; кирилл А, В, С, Д, Е әріптері де танылады)
// Дұрыс жауап (міндетті емес): нұсқа алдында/соңында «*» немесе «+»,
// не сұрақтан кейін «Жауабы: B», не соңында «Жауаптар: 1-B, 2-AC …» кілті.
// Сұрақтар арасындағы бөлек мәтін (мәтін, кесте атауы) келесі сұраққа контекст ретінде қосылады.

import { OPTION_LETTERS } from "./question-import";

export type ParsedQuestion = {
  /** Мәтіндегі нөмірі (болса) */
  number: number | null;
  stem: string;
  options: string[];
  /** 0-ден басталатын дұрыс нұсқа индекстері (мәтінде белгіленбесе — бос) */
  correct: number[];
};

export type ParseResult = { questions: ParsedQuestion[]; skipped: string[] };

const CYRILLIC_TO_LATIN: Record<string, string> = { А: "A", В: "B", С: "C", Д: "D", Е: "E" };
const QUESTION_RE = /^(\d{1,3})\s*[.)]\s*(.*)$/;
// Нұсқа: «A) мәтін», «*A) мәтін», «+ B) мәтін», «C) мәтін *»
const OPTION_RE = /^([*+]\s*)?([A-HАВСДЕ])\s*\)\s*(.*)$/;
const ANSWER_LINE_RE = /^(?:жауабы|жауап|дұрыс жауап|ответ|правильный ответ|answer)\s*[:\-–]\s*([A-HАВСДЕ](?:\s*[,;]?\s*[A-HАВСДЕ])*)\s*$/i;
// Тек тақырыптың өзі немесе «Тақырып: …» (сұрақ мәтіні «Ответы учеников…» деп басталса, кілт емес)
const KEY_HEADER_RE = /^(?:жауаптар|жауап кілті|дұрыс жауаптар|ответы|ключ(?: ответов)?|answers?(?: key)?)\s*(?::\s*(.*))?$/i;
const KEY_PAIR_RE = /(\d{1,3})\s*[-–—.):]?\s*([A-HАВСДЕ]+)(?![A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі])/g;
const INSTRUCTION_RE = /^(?:нұсқау|инструкция)\s*:/i;
const END_RE = /(?:сынақ аяқталды|тест окончен|тестілеу аяқталды)/i;

const latin = (letter: string) => CYRILLIC_TO_LATIN[letter] ?? letter;
const letterIndex = (letter: string) => OPTION_LETTERS.indexOf(latin(letter.toUpperCase()) as (typeof OPTION_LETTERS)[number]);

/** Кіші әрпі жоқ қысқа жол — бөлім тақырыбы («ҚАЗАҚСТАН ТАРИХЫ») */
function isHeading(line: string) {
  return line.length <= 80 && /\p{Lu}/u.test(line) && !/\p{Ll}/u.test(line);
}

function cleanLine(raw: string) {
  return raw.replace(/ /g, " ").replace(/[ \t]+/g, " ").trim();
}

/** «AC», «A, C», «А,С» → [0, 2] */
function lettersToIndexes(value: string) {
  return [...new Set([...value.replace(/[\s,;]/g, "")].map(letterIndex).filter((i) => i >= 0))].sort((a, b) => a - b);
}

export function parseTestText(input: string): ParseResult {
  const lines = input.replace(/\r\n?/g, "\n").split("\n").map(cleanLine);
  const questions: ParsedQuestion[] = [];
  const skipped: string[] = [];
  const key = new Map<number, number[]>();

  let current: (ParsedQuestion & { lastWasBlank: boolean }) | null = null;
  let context: string[] = []; // сұрақтар арасындағы мәтін → келесі сұраққа
  let inInstruction = false;
  let inKey = false;

  const finish = () => {
    if (current) {
      questions.push({
        number: current.number,
        stem: current.stem.trim(),
        options: current.options.map((o) => o.trim()),
        correct: current.correct,
      });
    }
    current = null;
  };

  for (const line of lines) {
    if (!line) {
      inInstruction = false;
      if (current) current.lastWasBlank = true;
      continue;
    }

    // Соңындағы жауап кілті
    const keyHeader = KEY_HEADER_RE.exec(line);
    if (keyHeader && !OPTION_RE.test(line)) {
      finish();
      inKey = true;
      for (const m of (keyHeader[1] ?? "").matchAll(KEY_PAIR_RE)) key.set(Number(m[1]), lettersToIndexes(m[2]));
      continue;
    }
    if (inKey) {
      const pairs = [...line.matchAll(KEY_PAIR_RE)];
      if (pairs.length) {
        for (const m of pairs) key.set(Number(m[1]), lettersToIndexes(m[2]));
        continue;
      }
      inKey = false;
    }

    if (END_RE.test(line)) {
      finish();
      skipped.push(line);
      continue;
    }
    if (INSTRUCTION_RE.test(line)) {
      inInstruction = true;
      skipped.push(line);
      continue;
    }
    if (inInstruction && !QUESTION_RE.test(line)) {
      skipped.push(line);
      continue;
    }
    inInstruction = false;

    // Сұрақтан кейінгі «Жауабы: B»
    const answer = ANSWER_LINE_RE.exec(line);
    if (answer && current) {
      current.correct = lettersToIndexes(answer[1]);
      continue;
    }

    const option = OPTION_RE.exec(line);
    if (option && current) {
      const index = letterIndex(option[2]);
      // Келесі әріп күтілген ретпен келсе ғана жаңа нұсқа (әйтпесе — мәтін жалғасы)
      if (index === current.options.length) {
        let text = option[3];
        let marked = Boolean(option[1]);
        if (/\s*[*+]$/.test(text) && !/[+]\s*[+]$/.test(text)) {
          text = text.replace(/\s*[*+]$/, "");
          marked = true;
        }
        current.options.push(text);
        if (marked) current.correct = [...current.correct, index];
        current.lastWasBlank = false;
        continue;
      }
    }

    const question = QUESTION_RE.exec(line);
    // Жаңа сұрақ: әлі сұрақ жоқ немесе алдыңғысының нұсқалары бар.
    // Нұсқасы жоқ сұрақтың ішіндегі «1. 2. 3.» — сұрақ мәтінінің бөлігі (дәйектер тізімі).
    if (question && (!current || current.options.length >= 2)) {
      finish();
      const stem = [...context.map((c) => `> ${c}`), ...(context.length ? [""] : []), question[2]].join("\n");
      current = { number: Number(question[1]), stem, options: [], correct: [], lastWasBlank: false };
      context = [];
      continue;
    }

    if (isHeading(line) && (!current || current.options.length >= 2)) {
      skipped.push(line);
      continue;
    }
    // Жалғыз сан — бет нөмірі
    if (/^\d{1,3}$/.test(line)) {
      skipped.push(line);
      continue;
    }

    if (!current) {
      context.push(line);
    } else if (current.options.length === 0) {
      current.stem += `\n${line}`;
    } else if (!current.lastWasBlank) {
      // Соңғы нұсқаның жалғасы (PDF жолды бөлгенде)
      current.options[current.options.length - 1] += ` ${line}`;
    } else {
      // Бос жолдан кейінгі мәтін — келесі сұрақтың контексі
      finish();
      context.push(line);
    }
  }
  finish();

  for (const q of questions) {
    if (!q.correct.length && q.number !== null && key.has(q.number)) {
      q.correct = (key.get(q.number) ?? []).filter((i) => i < q.options.length);
    }
  }
  return { questions, skipped };
}
