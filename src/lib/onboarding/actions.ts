"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth/session";
import { asLocale } from "@/lib/content/localize";
import { awardXp } from "@/lib/gamification/xp";
import { generateStudyPlan } from "@/lib/plan/server";
import { shuffle } from "@/lib/quiz/grading";
import { buildOptionOrder, cryptoRandom, finalizeAttempt, loadOwnedAttempt } from "@/lib/quiz/server";
import type { ActionResult, QuizErrorKey, QuizResult } from "@/lib/quiz/types";
import { rateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const err = <T>(error: QuizErrorKey): ActionResult<T> => ({ ok: false, error });
function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof AuthError) return err("unauthenticated");
  console.error("onboarding action failed", error);
  return err("unknown");
}

/** Мақсат: балл немесе мамандық (мамандық таңдалса — оның шекті балы мақсат болады). */
export async function saveGoal(input: { targetScore: number | null; specialtyId: string | null }) {
  try {
    const user = await requireUser();
    const parsed = z
      .object({ targetScore: z.number().int().min(50).max(140).nullable(), specialtyId: z.uuid().nullable() })
      .safeParse(input);
    if (!parsed.success) return { ok: false as const };

    const supabase = await createClient();
    let target = parsed.data.targetScore;
    if (parsed.data.specialtyId) {
      const { data: specialty } = await supabase
        .from("specialties")
        .select("threshold_score")
        .eq("id", parsed.data.specialtyId)
        .maybeSingle();
      if (!specialty) return { ok: false as const };
      target = specialty.threshold_score;
    }

    await supabase
      .from("profiles")
      .update({ target_score: target, target_specialty_id: parsed.data.specialtyId })
      .eq("id", user.id);
    return { ok: true as const };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("saveGoal failed", error);
    return { ok: false as const };
  }
}

/** Диагностикалық тест: әр пәннен бірнеше кездейсоқ сұрақ (барлық тақырыптардан). */
export async function startDiagnostic(): Promise<ActionResult<{ attemptId: string; total: number }>> {
  try {
    const user = await requireUser();
    if (!(await rateLimit(`diagnostic:start:${user.id}`, 5, 60 * 60))) return err("rate_limited");

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("attempts")
      .select("id, question_ids")
      .eq("user_id", user.id)
      .eq("kind", "diagnostic")
      .eq("status", "in_progress")
      .maybeSingle();
    if (existing) return { ok: true, data: { attemptId: existing.id, total: existing.question_ids.length } };

    const [settings, locale, { data: subjects }] = await Promise.all([
      getSetting("diagnostic"),
      getLocale().then(asLocale),
      admin.from("subjects").select("id, code").order("position"),
    ]);

    const questionIds: string[] = [];
    for (const subject of subjects ?? []) {
      const count = settings.perSubject[subject.code] ?? 0;
      if (!count) continue;
      const pick = async (byLocale: boolean) => {
        let query = admin.from("questions").select("id").eq("subject_id", subject.id).eq("is_active", true);
        if (byLocale) query = query.eq("locale", locale);
        const { data } = await query.limit(500);
        return (data ?? []).map((q) => q.id);
      };
      let ids = await pick(true);
      if (ids.length === 0) ids = await pick(false);
      questionIds.push(...shuffle(ids, cryptoRandom).slice(0, count));
    }
    if (questionIds.length === 0) return err("no_questions");

    const { data: attempt, error } = await admin
      .from("attempts")
      .insert({
        user_id: user.id,
        kind: "diagnostic",
        locale,
        question_ids: questionIds,
        option_order: await buildOptionOrder(questionIds),
        deadline_at: new Date(Date.now() + settings.durationMinutes * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !attempt) throw error;
    return { ok: true, data: { attemptId: attempt.id, total: questionIds.length } };
  } catch (error) {
    return fail(error);
  }
}

async function completeOnboarding(userId: string) {
  await createAdminClient()
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId)
    .is("onboarding_completed_at", null);
}

/** Диагностиканы аяқтау → онбординг аяқталады → AI жеке жоспар құрады (бірнеше секунд). */
export async function finishDiagnostic(attemptId: string): Promise<ActionResult<QuizResult>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(attemptId).success) return err("invalid_input");
    const attempt = await loadOwnedAttempt(attemptId, user.id, ["diagnostic"]);
    if (!attempt) return err("not_found");

    const [{ correct, total, percent }, xp] = await Promise.all([finalizeAttempt(attempt), getSetting("xp")]);
    await completeOnboarding(user.id);
    const award = await awardXp(user.id, xp.diagnosticFinished, "diagnostic_finished", attempt.id);
    await generateStudyPlan(user.id, "diagnostic", attempt.id);

    return {
      ok: true,
      data: {
        correct,
        total,
        percent,
        passPercent: 0,
        passed: true,
        lessonXp: award?.awarded ? xp.diagnosticFinished : 0,
        level: award?.level ?? null,
        levelUp: award?.levelUp ?? false,
      },
    };
  } catch (error) {
    return fail(error);
  }
}

/** Диагностикасыз өту (кейін тапсыруға болады). */
export async function skipOnboarding(): Promise<{ ok: boolean }> {
  try {
    const user = await requireUser();
    await completeOnboarding(user.id);
    await generateStudyPlan(user.id, "manual");
    return { ok: true };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("skipOnboarding failed", error);
    return { ok: false };
  }
}
