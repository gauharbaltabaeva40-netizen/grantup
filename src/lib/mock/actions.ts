"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccess } from "@/lib/access";
import { AuthError, requireUser } from "@/lib/auth/session";
import { loadOwnedAttempt, loadQuestionPayload } from "@/lib/quiz/server";
import type { QuizQuestion } from "@/lib/quiz/types";
import { rateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMockLayout, finalizeMock, isPastDeadline } from "./server";
import type { MockErrorKey, MockResult } from "./types";

const err = <T>(error: MockErrorKey): MockResult<T> => ({ ok: false, error });
function fail<T>(error: unknown): MockResult<T> {
  if (error instanceof AuthError) return err("unauthenticated");
  console.error("mock action failed", error);
  return err("unknown");
}

/** Сынақ ҰБТ-ны бастау (аяқталмаған сынақ болса — соны жалғастырамыз). */
export async function startMock(mockExamId: string): Promise<MockResult<{ attemptId: string }>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(mockExamId).success) return err("invalid_input");
    if (!(await rateLimit(`mock:start:${user.id}`, 10, 10 * 60))) return err("rate_limited");

    const admin = createAdminClient();
    const { data: active } = await admin
      .from("attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("kind", "mock")
      .eq("status", "in_progress")
      .maybeSingle();
    if (active) {
      if (!isPastDeadline(active)) return { ok: true, data: { attemptId: active.id } };
      await finalizeMock(active, "expired");
    }

    const { data: exam } = await admin
      .from("mock_exams")
      .select("id, is_free, is_published, locale")
      .eq("id", mockExamId)
      .maybeSingle();
    if (!exam?.is_published) return err("not_found");
    if (!exam.is_free && (await getAccess()).tier !== "full") return err("locked");

    const structure = await getSetting("unt_structure");
    const built = await buildMockLayout(exam.id, structure);
    if (!built || built.questionIds.length === 0) return err("no_questions");

    const now = Date.now();
    const { data: attempt, error } = await admin
      .from("attempts")
      .insert({
        user_id: user.id,
        kind: "mock",
        locale: exam.locale,
        mock_exam_id: exam.id,
        question_ids: built.questionIds,
        option_order: built.optionOrder,
        structure: { ...structure, layout: built.layout },
        started_at: new Date(now).toISOString(),
        deadline_at: new Date(now + structure.durationMinutes * 60_000).toISOString(),
      })
      .select("id")
      .single();
    // 23505 — басқа қойындыда бір мезгілде басталып қойды
    if (error?.code === "23505") {
      const { data: existing } = await admin
        .from("attempts")
        .select("id")
        .eq("user_id", user.id)
        .eq("kind", "mock")
        .eq("status", "in_progress")
        .single();
      return existing ? { ok: true, data: { attemptId: existing.id } } : err("unknown");
    }
    if (error || !attempt) throw error;

    return { ok: true, data: { attemptId: attempt.id } };
  } catch (error) {
    return fail(error);
  }
}

/** Бір сұрақ (дұрыс жауапсыз). Сұрақтар тек оқушы ашқанда, бір-бірлеп жүктеледі. */
export async function getMockQuestion(attemptId: string, index: number): Promise<MockResult<QuizQuestion>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(attemptId).success || !Number.isInteger(index) || index < 0) return err("invalid_input");
    if (!(await rateLimit(`mock:question:${user.id}`, 300, 60))) return err("rate_limited");

    const attempt = await loadOwnedAttempt(attemptId, user.id, ["mock"]);
    if (!attempt) return err("not_found");
    if (attempt.status !== "in_progress") return err("time_over");

    const payload = await loadQuestionPayload(attempt, index);
    if (!payload) return err("not_found");
    // Сынақ кезінде жауаптың дұрыс-бұрысы ешқашан берілмейді
    return { ok: true, data: { ...payload, feedback: null } };
  } catch (error) {
    return fail(error);
  }
}

const saveSchema = z.object({
  attemptId: z.uuid(),
  questionId: z.uuid(),
  selected: z.array(z.uuid()).max(10),
  flagged: z.boolean(),
  timeSpentMs: z.number().int().min(0).max(4 * 3600_000),
});

/**
 * Жауапты сақтау (әр өзгерісте). Бағаланбайды — тек таңдау, белгі және уақыт.
 * Дедлайннан кейін (+ қосымша уақыт) қабылданбайды.
 */
export async function saveMockAnswer(input: z.infer<typeof saveSchema>): Promise<MockResult<null>> {
  try {
    const user = await requireUser();
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    if (!(await rateLimit(`mock:save:${user.id}`, 240, 60))) return err("rate_limited");

    const { attemptId, questionId, selected, flagged, timeSpentMs } = parsed.data;
    const attempt = await loadOwnedAttempt(attemptId, user.id, ["mock"]);
    if (!attempt || !attempt.question_ids.includes(questionId)) return err("not_found");
    if (attempt.status !== "in_progress" || isPastDeadline(attempt)) return err("time_over");

    const admin = createAdminClient();
    if (selected.length) {
      const { data: question } = await admin.from("questions").select("type").eq("id", questionId).single();
      const { data: options } = await admin.from("question_options").select("id").eq("question_id", questionId);
      const valid = new Set((options ?? []).map((o) => o.id));
      if (selected.some((id) => !valid.has(id))) return err("invalid_input");
      if (question?.type === "single" && selected.length > 1) return err("invalid_input");
    }

    const { error } = await admin.from("attempt_answers").upsert({
      attempt_id: attemptId,
      question_id: questionId,
      user_id: user.id,
      selected_option_ids: [...new Set(selected)],
      flagged,
      time_spent_ms: timeSpentMs,
      answered_at: selected.length ? new Date().toISOString() : null,
    });
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

/** Сынақты аяқтау және бағалау. */
export async function finishMock(attemptId: string): Promise<MockResult<{ attemptId: string }>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(attemptId).success) return err("invalid_input");

    const attempt = await loadOwnedAttempt(attemptId, user.id, ["mock"]);
    if (!attempt) return err("not_found");
    if (attempt.status === "in_progress") {
      await finalizeMock(attempt, isPastDeadline(attempt) ? "expired" : "finished");
    }
    revalidatePath("/mock-exam", "layout");
    return { ok: true, data: { attemptId } };
  } catch (error) {
    return fail(error);
  }
}

/** Аяқталған сынақтың сұрағы — оқушы жауабы, дұрыс жауап және түсіндірмемен (шолу режимі). */
export async function getMockReviewQuestion(attemptId: string, index: number): Promise<MockResult<QuizQuestion>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(attemptId).success || !Number.isInteger(index) || index < 0) return err("invalid_input");

    const attempt = await loadOwnedAttempt(attemptId, user.id, ["mock"]);
    if (!attempt) return err("not_found");
    if (attempt.status === "in_progress") return err("locked");

    const payload = await loadQuestionPayload(attempt, index);
    return payload ? { ok: true, data: payload } : err("not_found");
  } catch (error) {
    return fail(error);
  }
}
