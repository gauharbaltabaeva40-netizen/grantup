import "server-only";
import { almatyToday, awardXp } from "@/lib/gamification/xp";
import { gradeAnswer, isEngaged, shuffle } from "@/lib/quiz/grading";
import { buildOptionOrder, cryptoRandom, updateMistake } from "@/lib/quiz/server";
import { getSetting, type UntStructure } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Attempt } from "@/lib/supabase/types";
import type { MockSection } from "./types";

/** Дедлайннан кейін желі кідірісі үшін қосымша уақыт (секунд) */
export const DEADLINE_GRACE_SECONDS = 60;

export type MockStructure = UntStructure & { layout: Omit<MockSection, "title">[] };

export function structureOf(attempt: Attempt): MockStructure {
  return attempt.structure as unknown as MockStructure;
}

export function isPastDeadline(attempt: Attempt, graceSeconds = DEADLINE_GRACE_SECONDS) {
  return Boolean(attempt.deadline_at) && Date.now() > new Date(attempt.deadline_at!).getTime() + graceSeconds * 1000;
}

/**
 * Вариант сұрақтарынан әрекет құрамын жасау:
 * - пәндер ҰБТ құрылымындағы ретпен;
 * - пән ішінде сұрақтар араластырылады, ал контекстік топтың сұрақтары бірге (өз ретімен) тұрады;
 * - әр сұрақтың нұсқалары да араластырылады.
 */
export async function buildMockLayout(mockExamId: string, structure: UntStructure) {
  const admin = createAdminClient();
  const [{ data: items }, { data: subjects }] = await Promise.all([
    admin.from("mock_exam_questions").select("question_id, subject_id, position").eq("mock_exam_id", mockExamId).order("position"),
    admin.from("subjects").select("id, code, position").order("position"),
  ]);
  if (!items?.length) return null;

  const { data: questions } = await admin
    .from("questions")
    .select("id, group_id")
    .in("id", items.map((i) => i.question_id))
    .eq("is_active", true);
  const groupOf = new Map((questions ?? []).map((q) => [q.id, q.group_id]));

  const sectionOrder = [
    ...structure.sections.map((s) => s.subject),
    ...(subjects ?? []).map((s) => s.code).filter((c) => !structure.sections.some((s) => s.subject === c)),
  ];
  const codeById = new Map((subjects ?? []).map((s) => [s.id, s.code]));

  const questionIds: string[] = [];
  const layout: MockStructure["layout"] = [];

  for (const code of sectionOrder) {
    const sectionItems = items.filter((i) => codeById.get(i.subject_id) === code && groupOf.has(i.question_id));
    if (sectionItems.length === 0) continue;

    // Контекстік топтар — бір блок; жеке сұрақ — өз блогы
    const blocks = new Map<string, string[]>();
    for (const item of sectionItems) {
      const key = groupOf.get(item.question_id) ?? item.question_id;
      blocks.set(key, [...(blocks.get(key) ?? []), item.question_id]);
    }
    const ordered = shuffle([...blocks.values()], cryptoRandom).flat();
    layout.push({ subject: code, start: questionIds.length, count: ordered.length });
    questionIds.push(...ordered);
  }

  return { questionIds, layout, optionOrder: await buildOptionOrder(questionIds) };
}

/**
 * Сынақты бағалау және аяқтау. Жауап берілмеген сұрақтар 0 балл болып сақталады (талдау мен шолу үшін).
 * Пән бойынша балл, уақыт, «Қателерім» жаңартылады; XP бір рет беріледі.
 */
export async function finalizeMock(attempt: Attempt, status: "finished" | "expired") {
  if (attempt.status !== "in_progress") return;

  const admin = createAdminClient();
  const structure = structureOf(attempt);
  const ids = attempt.question_ids;

  const [{ data: questions }, { data: options }, { data: answers }] = await Promise.all([
    admin.from("questions").select("id, type, group_id").in("id", ids),
    admin.from("question_options").select("id, question_id, is_correct").in("question_id", ids),
    admin.from("attempt_answers").select("question_id, selected_option_ids, flagged, time_spent_ms").eq("attempt_id", attempt.id),
  ]);

  const questionById = new Map((questions ?? []).map((q) => [q.id, q]));
  const answerById = new Map((answers ?? []).map((a) => [a.question_id, a]));
  const sectionOf = (index: number) => structure.layout.find((s) => index >= s.start && index < s.start + s.count)?.subject ?? "other";

  const sectionScores: Record<string, { score: number; max: number; correct: number; total: number }> = {};
  const timeBySubject: Record<string, number> = {};
  const rows = [];
  let score = 0;
  let maxScore = 0;

  for (const [index, questionId] of ids.entries()) {
    const question = questionById.get(questionId);
    if (!question) continue;
    const answer = answerById.get(questionId);
    const selected = answer?.selected_option_ids ?? [];
    const correctIds = (options ?? []).filter((o) => o.question_id === questionId && o.is_correct).map((o) => o.id);
    const kind = question.type === "multiple" ? "multiple" : question.group_id ? "context" : "single";
    const grade = gradeAnswer(kind, correctIds, selected, structure.scoring);

    const subject = sectionOf(index);
    const section = (sectionScores[subject] ??= { score: 0, max: 0, correct: 0, total: 0 });
    section.score += grade.points;
    section.max += grade.maxPoints;
    section.total += 1;
    if (grade.isCorrect) section.correct += 1;
    timeBySubject[subject] = (timeBySubject[subject] ?? 0) + Math.round((answer?.time_spent_ms ?? 0) / 1000);
    score += grade.points;
    maxScore += grade.maxPoints;

    rows.push({
      attempt_id: attempt.id,
      question_id: questionId,
      user_id: attempt.user_id,
      selected_option_ids: selected,
      flagged: answer?.flagged ?? false,
      time_spent_ms: answer?.time_spent_ms ?? 0,
      is_correct: grade.isCorrect,
      points: grade.points,
      answered_at: selected.length ? new Date().toISOString() : null,
    });

    // Жауап берілгендер ғана «Қателерім»-ге әсер етеді
    if (selected.length) await updateMistake(attempt.user_id, questionId, grade.isCorrect);
  }

  await admin.from("attempt_answers").upsert(rows);

  const { error } = await admin
    .from("attempts")
    .update({
      status,
      finished_at: new Date().toISOString(),
      score,
      max_score: maxScore,
      section_scores: sectionScores,
      time_by_subject: timeBySubject,
    })
    .eq("id", attempt.id)
    .eq("status", "in_progress");
  if (error) throw error;

  // XP тек сұрақтардың кемінде жартысына жауап берілсе (бос аяқталған сынаққа марапат жоқ)
  if (isEngaged(rows.filter((r) => r.answered_at).length, rows.length)) {
    const xp = await getSetting("xp");
    await awardXp(attempt.user_id, xp.mockFinished, "mock_finished", attempt.id);
  }
  return { score, maxScore, today: almatyToday() };
}

/** Мерзімі өткен аяқталмаған сынақтарды автоматты аяқтау (оқушы қайта кіргенде). */
export async function expireOverdueMocks(userId: string) {
  const { data } = await createAdminClient()
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "mock")
    .eq("status", "in_progress");
  for (const attempt of data ?? []) {
    if (isPastDeadline(attempt)) await finalizeMock(attempt, "expired");
  }
}
