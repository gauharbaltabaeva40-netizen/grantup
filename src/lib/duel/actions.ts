"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth/session";
import { asLocale } from "@/lib/content/localize";
import { finalizeAttempt, gradeAndStore, loadQuestionPayload } from "@/lib/quiz/server";
import type { AnswerFeedback, QuizQuestion } from "@/lib/quiz/types";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  attemptIdFor,
  closeIfOverdue,
  createDuelAttempt,
  isParticipant,
  isPastDuelDeadline,
  joinOpenDuel,
  loadAttempt,
  loadDuel,
  newDuel,
  settleDuel,
} from "./server";
import type { DuelErrorKey, DuelResult } from "./types";

const err = <T>(error: DuelErrorKey): DuelResult<T> => ({ ok: false, error });
function fail<T>(error: unknown): DuelResult<T> {
  if (error instanceof AuthError) return err("unauthenticated");
  console.error("duel action failed", error);
  return err("unknown");
}

async function subjectIdOf(code: string | null) {
  if (!code) return null;
  const { data } = await createAdminClient().from("subjects").select("id").eq("code", code).maybeSingle();
  return data?.id ?? null;
}

/**
 * Жаңа дуэль.
 * - friend: шақыру сілтемесі бар жабық дуэль;
 * - random: алдымен біреудің ашық дуэліне қосыламыз, болмаса — өзіміз ашық дуэль құрамыз (кейін біреу қосылады).
 */
export async function createDuel(input: { mode: "friend" | "random"; subjectCode: string | null }): Promise<DuelResult<{ duelId: string }>> {
  try {
    const user = await requireUser();
    const parsed = z
      .object({ mode: z.enum(["friend", "random"]), subjectCode: z.string().regex(/^[a-z_]+$/).nullable() })
      .safeParse(input);
    if (!parsed.success) return err("invalid_input");
    if (!(await rateLimit(`duel:create:${user.id}`, 30, 86400))) return err("rate_limited");

    const locale = asLocale(await getLocale());
    const subjectId = await subjectIdOf(parsed.data.subjectCode);
    if (parsed.data.subjectCode && !subjectId) return err("not_found");

    if (parsed.data.mode === "random") {
      const joined = await joinOpenDuel(user.id, locale, subjectId);
      if (joined) return { ok: true, data: { duelId: joined.id } };
    }

    const duel = await newDuel({ userId: user.id, locale, subjectId, isOpen: parsed.data.mode === "random" });
    if (!duel) return err("no_questions");
    revalidatePath("/duel");
    return { ok: true, data: { duelId: duel.id } };
  } catch (error) {
    return fail(error);
  }
}

/** Шақыру коды арқылы қосылу (сілтеме: /duel/join/<код>) */
export async function joinDuelByCode(code: string): Promise<DuelResult<{ duelId: string }>> {
  try {
    const user = await requireUser();
    if (!/^[A-Z2-9]{6}$/.test(code)) return err("not_found");
    if (!(await rateLimit(`duel:join:${user.id}`, 60, 3600))) return err("rate_limited");

    const admin = createAdminClient();
    const { data: duel } = await admin.from("duels").select("*").eq("code", code).maybeSingle();
    if (!duel) return err("not_found");
    if (isParticipant(duel, user.id)) return { ok: true, data: { duelId: duel.id } };
    if (duel.opponent_id) return err("taken");
    if (duel.finished_at || new Date(duel.expires_at).getTime() < Date.now()) return err("expired");

    const { data: taken } = await admin
      .from("duels")
      .update({ opponent_id: user.id })
      .eq("id", duel.id)
      .is("opponent_id", null)
      .select("id")
      .maybeSingle();
    if (!taken) return err("taken");
    return { ok: true, data: { duelId: duel.id } };
  } catch (error) {
    return fail(error);
  }
}

async function ownDuel(duelId: string, userId: string) {
  if (!z.uuid().safeParse(duelId).success) return null;
  const duel = await loadDuel(duelId);
  return duel && isParticipant(duel, userId) ? duel : null;
}

/** «Бастау»: ойыншының әрекеті ашылып, таймер іске қосылады. */
export async function startDuelRound(duelId: string): Promise<DuelResult<{ attemptId: string }>> {
  try {
    const user = await requireUser();
    const duel = await ownDuel(duelId, user.id);
    if (!duel) return err("not_found");
    const existing = await loadAttempt(attemptIdFor(duel, user.id));
    if (existing) return existing.status === "in_progress" ? { ok: true, data: { attemptId: existing.id } } : err("time_over");
    if (duel.finished_at || new Date(duel.expires_at).getTime() < Date.now()) return err("expired");

    const attempt = await createDuelAttempt(duel, user.id);
    return { ok: true, data: { attemptId: attempt.id } };
  } catch (error) {
    return fail(error);
  }
}

async function activeAttempt(
  duelId: string,
  userId: string,
): Promise<{ error: DuelErrorKey } | { duel: NonNullable<Awaited<ReturnType<typeof ownDuel>>>; attempt: NonNullable<Awaited<ReturnType<typeof loadAttempt>>> }> {
  const duel = await ownDuel(duelId, userId);
  if (!duel) return { error: "not_found" };
  const attempt = await loadAttempt(attemptIdFor(duel, userId));
  if (!attempt || attempt.status !== "in_progress") return { error: "time_over" };
  if (isPastDuelDeadline(attempt)) {
    await closeIfOverdue(attempt);
    return { error: "time_over" };
  }
  return { duel, attempt };
}

/** Сұрақ (дұрыс жауапсыз) */
export async function getDuelQuestion(duelId: string, index: number): Promise<DuelResult<QuizQuestion>> {
  try {
    const user = await requireUser();
    if (!Number.isInteger(index) || index < 0 || index > 50) return err("invalid_input");
    const found = await activeAttempt(duelId, user.id);
    if ("error" in found) return err(found.error);
    const question = await loadQuestionPayload(found.attempt, index);
    return question ? { ok: true, data: question } : err("not_found");
  } catch (error) {
    return fail(error);
  }
}

/** Жауап: бірден дұрыс/қате көрсетіледі; «Қателерім» мен XP ортақ ережемен жаңарады. */
export async function answerDuel(input: { duelId: string; questionId: string; selected: string[] }): Promise<DuelResult<AnswerFeedback>> {
  try {
    const user = await requireUser();
    const parsed = z
      .object({ duelId: z.uuid(), questionId: z.uuid(), selected: z.array(z.uuid()).min(1).max(1) })
      .safeParse(input);
    if (!parsed.success) return err("invalid_input");
    if (!(await rateLimit(`duel:answer:${user.id}`, 120, 600))) return err("rate_limited");

    const found = await activeAttempt(parsed.data.duelId, user.id);
    if ("error" in found) return err(found.error);
    const result = await gradeAndStore(found.attempt, parsed.data.questionId, parsed.data.selected);
    if (result === "invalid_input" || result === "already_answered") return err("invalid_input");
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/** Раундты аяқтау: екеуі де ойнап болса — жеңімпаз анықталады. */
export async function finishDuelRound(duelId: string): Promise<DuelResult<null>> {
  try {
    const user = await requireUser();
    const duel = await ownDuel(duelId, user.id);
    if (!duel) return err("not_found");
    const attempt = await loadAttempt(attemptIdFor(duel, user.id));
    if (attempt?.status === "in_progress") await finalizeAttempt(attempt);
    await settleDuel((await loadDuel(duel.id)) ?? duel);
    revalidatePath("/duel");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
