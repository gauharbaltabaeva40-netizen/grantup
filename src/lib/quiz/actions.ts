"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth/session";
import { QUIZ_MAX_QUESTIONS } from "@/lib/content/catalog";
import { asLocale } from "@/lib/content/localize";
import { awardXp } from "@/lib/gamification/xp";
import { rateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { shuffle } from "./grading";
import { buildOptionOrder, cryptoRandom, finalizeAttempt, gradeAndStore, loadOwnedAttempt, loadQuestionPayload } from "./server";
import type { ActionResult, AnswerFeedback, QuizErrorKey, QuizQuestion, QuizResult } from "./types";

function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof AuthError) return { ok: false, error: "unauthenticated" };
  console.error("quiz action failed", error);
  return { ok: false, error: "unknown" };
}

const err = <T>(error: QuizErrorKey): ActionResult<T> => ({ ok: false, error });

/** Сабаққа доступ бар ма — RLS функциясы арқылы (оқушы сессиясымен). */
async function canAccessLesson(lessonId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_access_lesson", { p_lesson: lessonId });
  return data === true;
}

/** Сабақ тестін бастау: тақырып сұрақтарынан 10-ға дейін кездейсоқ таңдалады, нұсқалар араластырылады. */
export async function startLessonQuiz(lessonId: string): Promise<ActionResult<{ attemptId: string; total: number }>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(lessonId).success) return err("invalid_input");
    if (!(await rateLimit(`quiz:start:${user.id}`, 20, 10 * 60))) return err("rate_limited");
    if (!(await canAccessLesson(lessonId))) return err("locked");

    const admin = createAdminClient();
    const { data: lesson } = await admin.from("lessons").select("id, topic_id").eq("id", lessonId).single();
    if (!lesson) return err("not_found");
    const { data: topic } = await admin.from("topics").select("subject_id").eq("id", lesson.topic_id).single();

    const locale = asLocale(await getLocale());
    const pick = async (byLocale: boolean) => {
      let query = admin.from("questions").select("id").eq("topic_id", lesson.topic_id).eq("is_active", true);
      if (byLocale) query = query.eq("locale", locale);
      const { data } = await query;
      return (data ?? []).map((q) => q.id);
    };
    let ids = await pick(true);
    if (ids.length === 0) ids = await pick(false);
    if (ids.length === 0) return err("no_questions");

    const questionIds = shuffle(ids, cryptoRandom).slice(0, QUIZ_MAX_QUESTIONS);

    // Осы сабақтың бұрынғы аяқталмаған тестін жабамыз
    await admin
      .from("attempts")
      .update({ status: "abandoned" })
      .eq("user_id", user.id)
      .eq("kind", "lesson_quiz")
      .eq("lesson_id", lessonId)
      .eq("status", "in_progress");

    const { data: attempt, error } = await admin
      .from("attempts")
      .insert({
        user_id: user.id,
        kind: "lesson_quiz",
        locale,
        lesson_id: lessonId,
        topic_id: lesson.topic_id,
        subject_id: topic?.subject_id ?? null,
        question_ids: questionIds,
        option_order: await buildOptionOrder(questionIds),
      })
      .select("id")
      .single();
    if (error || !attempt) throw error;

    return { ok: true, data: { attemptId: attempt.id, total: questionIds.length } };
  } catch (error) {
    return fail(error);
  }
}

export async function getQuizQuestion(attemptId: string, index: number): Promise<ActionResult<QuizQuestion>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(attemptId).success || !Number.isInteger(index) || index < 0) return err("invalid_input");

    const attempt = await loadOwnedAttempt(attemptId, user.id, ["lesson_quiz", "practice", "mistakes"]);
    if (!attempt) return err("not_found");
    if (attempt.lesson_id && !(await canAccessLesson(attempt.lesson_id))) return err("locked");

    const payload = await loadQuestionPayload(attempt, index);
    return payload ? { ok: true, data: payload } : err("not_found");
  } catch (error) {
    return fail(error);
  }
}

export async function submitQuizAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[],
): Promise<ActionResult<AnswerFeedback>> {
  try {
    const user = await requireUser();
    const parsed = z
      .object({ attemptId: z.uuid(), questionId: z.uuid(), selected: z.array(z.uuid()).min(1).max(10) })
      .safeParse({ attemptId, questionId, selected: selectedOptionIds });
    if (!parsed.success) return err("invalid_input");
    if (!(await rateLimit(`quiz:answer:${user.id}`, 60, 60))) return err("rate_limited");

    const attempt = await loadOwnedAttempt(attemptId, user.id, ["lesson_quiz", "practice", "mistakes"]);
    if (!attempt || attempt.status !== "in_progress") return err("not_found");

    const result = await gradeAndStore(attempt, questionId, parsed.data.selected);
    if (typeof result === "string") return err(result);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Сабақ тестін аяқтау. Нәтиже ≥ өту шегі (әдепкі 70%) болса — сабақ аяқталады және XP беріледі (бір рет).
 */
export async function finishLessonQuiz(attemptId: string): Promise<ActionResult<QuizResult>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(attemptId).success) return err("invalid_input");

    const attempt = await loadOwnedAttempt(attemptId, user.id, ["lesson_quiz"]);
    if (!attempt?.lesson_id) return err("not_found");

    const [{ correct, total, percent }, xp] = await Promise.all([finalizeAttempt(attempt), getSetting("xp")]);
    const passed = percent >= xp.quizPassPercent;
    const admin = createAdminClient();

    const { data: progress } = await admin
      .from("lesson_progress")
      .select("quiz_best_percent, completed_at")
      .eq("user_id", user.id)
      .eq("lesson_id", attempt.lesson_id)
      .maybeSingle();

    await admin.from("lesson_progress").upsert({
      user_id: user.id,
      lesson_id: attempt.lesson_id,
      quiz_best_percent: Math.max(percent, progress?.quiz_best_percent ?? 0),
      completed_at: progress?.completed_at ?? (passed ? new Date().toISOString() : null),
    });

    let lessonXp = 0;
    let level: number | null = null;
    let levelUp = false;
    if (passed) {
      const { data: lesson } = await admin.from("lessons").select("xp_reward").eq("id", attempt.lesson_id).single();
      const award = await awardXp(user.id, lesson?.xp_reward ?? xp.lessonComplete, "lesson_complete", attempt.lesson_id);
      if (award?.awarded) {
        lessonXp = lesson?.xp_reward ?? xp.lessonComplete;
        level = award.level;
        levelUp = award.levelUp;
      }
    }

    revalidatePath("/lessons", "layout");
    return { ok: true, data: { correct, total, percent, passPercent: xp.quizPassPercent, passed, lessonXp, level, levelUp } };
  } catch (error) {
    return fail(error);
  }
}
