"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth/session";
import { getAccessibleTopicIds, getCatalog } from "@/lib/content/catalog";
import { asLocale } from "@/lib/content/localize";
import { shuffle } from "@/lib/quiz/grading";
import { buildOptionOrder, cryptoRandom, finalizeAttempt, loadOwnedAttempt } from "@/lib/quiz/server";
import type { ActionResult, QuizErrorKey, QuizResult } from "@/lib/quiz/types";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AttemptKind } from "@/lib/supabase/types";
import { PRACTICE_SIZES } from "./constants";
import { getOpenMistakes } from "./data";

const MISTAKES_BATCH = 20;

const err = <T>(error: QuizErrorKey): ActionResult<T> => ({ ok: false, error });
function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof AuthError) return err("unauthenticated");
  console.error("practice action failed", error);
  return err("unknown");
}

async function createAttempt(
  userId: string,
  kind: AttemptKind,
  questionIds: string[],
  extra: { subject_id?: number | null; topic_id?: string | null },
) {
  const admin = createAdminClient();
  // Осы түрдегі бұрынғы аяқталмаған әрекеттерді жабамыз
  await admin.from("attempts").update({ status: "abandoned" }).eq("user_id", userId).eq("kind", kind).eq("status", "in_progress");

  const { data, error } = await admin
    .from("attempts")
    .insert({
      user_id: userId,
      kind,
      locale: asLocale(await getLocale()),
      question_ids: questionIds,
      option_order: await buildOptionOrder(questionIds),
      ...extra,
    })
    .select("id")
    .single();
  if (error || !data) throw error;
  return data.id;
}

/** Пән немесе тақырып бойынша жаттығу: ашық тақырыптардан кездейсоқ сұрақтар. */
export async function startPractice(input: {
  subjectCode: string;
  topicId: string | null;
  size: number;
}): Promise<ActionResult<{ attemptId: string; total: number }>> {
  try {
    const user = await requireUser();
    const parsed = z
      .object({
        subjectCode: z.string().regex(/^[a-z_]+$/),
        topicId: z.uuid().nullable(),
        size: z.number().refine((n) => (PRACTICE_SIZES as readonly number[]).includes(n)),
      })
      .safeParse(input);
    if (!parsed.success) return err("invalid_input");
    if (!(await rateLimit(`practice:start:${user.id}`, 30, 10 * 60))) return err("rate_limited");

    const locale = await getLocale();
    const [catalog, accessible] = await Promise.all([getCatalog(locale), getAccessibleTopicIds(locale)]);
    const subject = catalog.find((s) => s.code === parsed.data.subjectCode);
    if (!subject) return err("not_found");

    const topicIds = (parsed.data.topicId ? [parsed.data.topicId] : subject.topics.map((t) => t.id)).filter((id) =>
      accessible.has(id),
    );
    if (parsed.data.topicId && topicIds.length === 0) return err("locked");
    if (topicIds.length === 0) return err("no_questions");

    const admin = createAdminClient();
    const pick = async (byLocale: boolean) => {
      let query = admin.from("questions").select("id").in("topic_id", topicIds).eq("is_active", true);
      if (byLocale) query = query.eq("locale", asLocale(locale));
      const { data } = await query;
      return (data ?? []).map((q) => q.id);
    };
    let ids = await pick(true);
    if (ids.length === 0) ids = await pick(false);
    if (ids.length === 0) return err("no_questions");

    const questionIds = shuffle(ids, cryptoRandom).slice(0, parsed.data.size);
    const attemptId = await createAttempt(user.id, "practice", questionIds, {
      subject_id: subject.id,
      topic_id: parsed.data.topicId,
    });
    return { ok: true, data: { attemptId, total: questionIds.length } };
  } catch (error) {
    return fail(error);
  }
}

/** «Қателерім»: түзелмеген қателерден (жаңалары бірінші) 20-ға дейін сұрақ қайта шешуге. */
export async function startMistakes(subjectCode: string | null): Promise<ActionResult<{ attemptId: string; total: number }>> {
  try {
    const user = await requireUser();
    if (subjectCode !== null && !/^[a-z_]+$/.test(subjectCode)) return err("invalid_input");
    if (!(await rateLimit(`practice:start:${user.id}`, 30, 10 * 60))) return err("rate_limited");

    const mistakes = await getOpenMistakes(await getLocale());
    const questionIds = mistakes
      .filter((m) => !subjectCode || m.subjectCode === subjectCode)
      .slice(0, MISTAKES_BATCH)
      .map((m) => m.questionId);
    if (questionIds.length === 0) return err("no_questions");

    const attemptId = await createAttempt(user.id, "mistakes", questionIds, {});
    return { ok: true, data: { attemptId, total: questionIds.length } };
  } catch (error) {
    return fail(error);
  }
}

/** Жаттығуды немесе «Қателерім» әрекетін аяқтау. */
export async function finishPractice(attemptId: string): Promise<ActionResult<QuizResult>> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(attemptId).success) return err("invalid_input");

    const attempt = await loadOwnedAttempt(attemptId, user.id, ["practice", "mistakes"]);
    if (!attempt) return err("not_found");

    const { correct, total, percent } = await finalizeAttempt(attempt);
    revalidatePath("/practice", "layout");
    return {
      ok: true,
      data: { correct, total, percent, passPercent: 0, passed: true, lessonXp: 0, level: null, levelUp: false },
    };
  } catch (error) {
    return fail(error);
  }
}
