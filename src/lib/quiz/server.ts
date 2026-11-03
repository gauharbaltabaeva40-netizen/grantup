import "server-only";
import { randomInt } from "node:crypto";
import { almatyToday, awardXp } from "@/lib/gamification/xp";
import { getSetting } from "@/lib/settings";
import { signedQuestionImage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Attempt, AttemptKind } from "@/lib/supabase/types";
import { gradeAnswer, shuffle } from "./grading";
import type { AnswerFeedback, QuizQuestion } from "./types";

// Тест әрекеттерінің ортақ серверлік логикасы (сабақ тесті, 5-кезеңдегі жаттығу мен «Қателерім» де осыны қолданады).
// Барлық оқу/жазу service_role арқылы, бірақ әр функция әрекеттің иесін тексереді.

export const cryptoRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

export async function buildOptionOrder(questionIds: string[]) {
  const { data: options } = await createAdminClient()
    .from("question_options")
    .select("id, question_id, position")
    .in("question_id", questionIds)
    .order("position");

  const order: Record<string, string[]> = {};
  for (const id of questionIds) {
    order[id] = shuffle(
      (options ?? []).filter((o) => o.question_id === id).map((o) => o.id),
      cryptoRandom,
    );
  }
  return order;
}

export async function loadOwnedAttempt(attemptId: string, userId: string, kinds: AttemptKind[]): Promise<Attempt | null> {
  const { data } = await createAdminClient()
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .in("kind", kinds)
    .maybeSingle();
  return data;
}

async function feedbackFor(questionId: string, answer: { selected_option_ids: string[]; is_correct: boolean | null; points: number | null }, maxPoints: number): Promise<AnswerFeedback> {
  const admin = createAdminClient();
  const [{ data: question }, { data: correct }] = await Promise.all([
    admin.from("questions").select("explanation").eq("id", questionId).single(),
    admin.from("question_options").select("id").eq("question_id", questionId).eq("is_correct", true),
  ]);
  return {
    isCorrect: Boolean(answer.is_correct),
    points: Number(answer.points ?? 0),
    maxPoints,
    selectedOptionIds: answer.selected_option_ids,
    correctOptionIds: (correct ?? []).map((o) => o.id),
    explanation: question?.explanation ?? "",
    xpAwarded: 0,
  };
}

/** Сұрақты клиентке береміз: мәтін + нұсқалар (әрекеттегі ретпен), ДҰРЫС ЖАУАПСЫЗ. */
export async function loadQuestionPayload(attempt: Attempt, index: number): Promise<QuizQuestion | null> {
  const questionId = attempt.question_ids[index];
  if (!questionId) return null;

  const admin = createAdminClient();
  const [{ data: question }, { data: options }, { data: answer }, scoring] = await Promise.all([
    admin.from("questions").select("id, type, stem, image_path, group_id").eq("id", questionId).single(),
    admin.from("question_options").select("id, content").eq("question_id", questionId),
    admin
      .from("attempt_answers")
      .select("selected_option_ids, is_correct, points")
      .eq("attempt_id", attempt.id)
      .eq("question_id", questionId)
      .maybeSingle(),
    getSetting("unt_structure").then((s) => s.scoring),
  ]);
  if (!question || !options) return null;

  const { data: group } = question.group_id
    ? await admin.from("question_groups").select("passage").eq("id", question.group_id).single()
    : { data: null };

  const order = ((attempt.option_order as Record<string, string[]>)[questionId] ?? options.map((o) => o.id));
  const byId = new Map(options.map((o) => [o.id, o]));
  const maxPoints = question.type === "multiple" ? scoring.multiple.maxPoints : question.group_id ? scoring.context : scoring.single;

  return {
    attemptId: attempt.id,
    index,
    total: attempt.question_ids.length,
    questionId,
    type: question.type,
    stem: question.stem,
    passage: group?.passage ?? null,
    imageUrl: await signedQuestionImage(question.image_path),
    options: order.map((id) => byId.get(id)).filter((o): o is { id: string; content: string } => Boolean(o)),
    feedback: answer && answer.is_correct !== null ? await feedbackFor(questionId, answer, maxPoints) : null,
  };
}

/**
 * Жауапты тексеріп сақтау. «Қателерім» жаңартылады; дұрыс жауапқа XP
 * (бір сұрақ үшін тәулігіне бір рет — қайта тапсырып XP жинауға болмайды).
 * Қайтарады null — сұрақ әрекетке жатпайды немесе жауап бұрын берілген.
 */
export async function gradeAndStore(
  attempt: Attempt,
  questionId: string,
  selectedIds: string[],
): Promise<AnswerFeedback | "already_answered" | "invalid_input"> {
  if (!attempt.question_ids.includes(questionId)) return "invalid_input";

  const admin = createAdminClient();
  const [{ data: question }, { data: options }, unt, xp] = await Promise.all([
    admin.from("questions").select("type, group_id, explanation").eq("id", questionId).single(),
    admin.from("question_options").select("id, is_correct").eq("question_id", questionId),
    getSetting("unt_structure"),
    getSetting("xp"),
  ]);
  if (!question || !options) return "invalid_input";

  const optionIds = new Set(options.map((o) => o.id));
  const selected = [...new Set(selectedIds)];
  if (selected.length === 0 || selected.some((id) => !optionIds.has(id))) return "invalid_input";
  if (question.type === "single" && selected.length !== 1) return "invalid_input";

  const correctIds = options.filter((o) => o.is_correct).map((o) => o.id);
  const kind = question.type === "multiple" ? "multiple" : question.group_id ? "context" : "single";
  const grade = gradeAnswer(kind, correctIds, selected, unt.scoring);

  const { error } = await admin.from("attempt_answers").insert({
    attempt_id: attempt.id,
    question_id: questionId,
    user_id: attempt.user_id,
    selected_option_ids: selected,
    is_correct: grade.isCorrect,
    points: grade.points,
    answered_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505") return "already_answered";
    throw error;
  }

  let xpAwarded = 0;
  const resolved = await updateMistake(attempt.user_id, questionId, grade.isCorrect);

  if (grade.isCorrect) {
    const award = await awardXp(attempt.user_id, xp.questionCorrect, "question_correct", `${questionId}:${almatyToday()}`);
    if (award?.awarded) xpAwarded += xp.questionCorrect;

    // Бұрынғы қате түзелді → қосымша XP
    if (resolved) {
      const fixed = await awardXp(attempt.user_id, xp.mistakeFixed, "mistake_fixed", `${questionId}:${attempt.id}`);
      if (fixed?.awarded) xpAwarded += xp.mistakeFixed;
    }
  }

  return {
    isCorrect: grade.isCorrect,
    points: grade.points,
    maxPoints: grade.maxPoints,
    selectedOptionIds: selected,
    correctOptionIds: correctIds,
    explanation: question.explanation,
    xpAwarded,
  };
}

/**
 * «Қателерім» тізімін жаңарту: қате → тізімге (қате саны +1), дұрыс → ашық қате болса түзелді деп белгілеу.
 * Қайтарады: true — бұрынғы қате дәл қазір түзелді.
 */
export async function updateMistake(userId: string, questionId: string, isCorrect: boolean): Promise<boolean> {
  const admin = createAdminClient();
  const { data: mistake } = await admin
    .from("user_mistakes")
    .select("wrong_count, resolved_at")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (!isCorrect) {
    await admin.from("user_mistakes").upsert({
      user_id: userId,
      question_id: questionId,
      wrong_count: (mistake?.wrong_count ?? 0) + 1,
      last_wrong_at: new Date().toISOString(),
      resolved_at: null,
    });
    return false;
  }

  if (mistake && !mistake.resolved_at) {
    await admin
      .from("user_mistakes")
      .update({ resolved_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("question_id", questionId);
    return true;
  }
  return false;
}

/** Әрекетті аяқтау: дұрыс жауаптар саны мен балл есептеледі. */
export async function finalizeAttempt(attempt: Attempt) {
  const admin = createAdminClient();
  const { data: answers } = await admin
    .from("attempt_answers")
    .select("is_correct, points")
    .eq("attempt_id", attempt.id);

  const correct = (answers ?? []).filter((a) => a.is_correct).length;
  const answered = (answers ?? []).filter((a) => a.is_correct !== null).length;
  const total = attempt.question_ids.length;
  const score = (answers ?? []).reduce((sum, a) => sum + Number(a.points ?? 0), 0);
  const percent = total ? Math.round((correct / total) * 100) : 0;

  if (attempt.status === "in_progress") {
    await admin
      .from("attempts")
      .update({ status: "finished", finished_at: new Date().toISOString(), score })
      .eq("id", attempt.id)
      .eq("status", "in_progress");
  }

  return { correct, total, percent, score, answered };
}
