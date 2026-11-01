"use server";

// Контент редакторы: пәндер, тақырыптар, сабақтар. Әр әрекет: requireAdmin → өзгеріс → audit_log.

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, fail, refreshAdmin } from "./audit";
import type { AdminResult } from "./types";
import { parseYoutubeId } from "./youtube";

const title = z.string().trim().min(1).max(200);

export async function updateSubject(input: { id: number; title_kk: string; title_ru: string; color: string }): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    const parsed = z
      .object({ id: z.number().int().positive(), title_kk: title, title_ru: title, color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const { id, ...values } = parsed.data;

    const { error } = await createAdminClient().from("subjects").update(values).eq("id", id);
    if (error) throw error;
    await audit(actor.id, "subject.update", "subject", String(id), values);
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------
// Тақырыптар
// ---------------------------------------------------------------------

const topicSchema = z.object({
  id: z.uuid().optional(),
  subject_id: z.number().int().positive(),
  title_kk: title,
  title_ru: title,
  is_published: z.boolean(),
});

export async function saveTopic(input: z.input<typeof topicSchema>): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    const parsed = topicSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const { id, ...values } = parsed.data;
    const admin = createAdminClient();

    if (id) {
      const { data, error } = await admin.from("topics").update(values).eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, error: "not_found" };
      await audit(actor.id, "topic.update", "topic", id, values);
    } else {
      const { data: last } = await admin
        .from("topics")
        .select("position")
        .eq("subject_id", values.subject_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data, error } = await admin
        .from("topics")
        .insert({ ...values, position: (last?.position ?? 0) + 1 })
        .select("id")
        .single();
      if (error) throw error;
      await audit(actor.id, "topic.create", "topic", data.id, values);
    }
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Ішінде сабақ бар тақырыпты өшірмейміз (оқушылардың прогресі жоғалмасын) — алдымен сабақтарды көшіру/өшіру керек. */
export async function deleteTopic(id: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();

    const { count } = await admin.from("lessons").select("id", { count: "exact", head: true }).eq("topic_id", id);
    if (count) return { ok: false, error: "in_use" };

    const { data, error } = await admin.from("topics").delete().eq("id", id).select("title_kk").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };
    await audit(actor.id, "topic.delete", "topic", id, { title: data.title_kk });
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Тақырыпты/сабақты бір орынға жоғары (-1) немесе төмен (+1) жылжыту. Көршілердің реті 1..n болып қайта нөмірленеді. */
export async function moveContent(kind: "topic" | "lesson", id: string, direction: -1 | 1): Promise<AdminResult> {
  try {
    await requireAdmin();
    if (!z.uuid().safeParse(id).success || ![-1, 1].includes(direction)) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();

    let siblings: { id: string; position: number }[];
    if (kind === "topic") {
      const { data: item } = await admin.from("topics").select("subject_id").eq("id", id).maybeSingle();
      if (!item) return { ok: false, error: "not_found" };
      siblings = (await admin.from("topics").select("id, position").eq("subject_id", item.subject_id).order("position").order("created_at")).data ?? [];
    } else {
      const { data: item } = await admin.from("lessons").select("topic_id").eq("id", id).maybeSingle();
      if (!item) return { ok: false, error: "not_found" };
      siblings = (await admin.from("lessons").select("id, position").eq("topic_id", item.topic_id).order("position").order("created_at")).data ?? [];
    }

    const index = siblings.findIndex((s) => s.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= siblings.length) return { ok: true };
    [siblings[index], siblings[target]] = [siblings[target], siblings[index]];

    const table = kind === "topic" ? "topics" : "lessons";
    for (const [i, s] of siblings.entries()) {
      if (s.position === i + 1) continue;
      const { error } = await admin.from(table).update({ position: i + 1 }).eq("id", s.id);
      if (error) throw error;
    }
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------
// Сабақтар
// ---------------------------------------------------------------------

export async function createLesson(input: { topic_id: string; title_kk: string; title_ru: string }): Promise<AdminResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = z.object({ topic_id: z.uuid(), title_kk: title, title_ru: title }).safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();

    const { data: last } = await admin
      .from("lessons")
      .select("position")
      .eq("topic_id", parsed.data.topic_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Жаңа сабақ жарияланбаған күйде жасалады — мазмұны толтырылғаннан кейін жарияланады
    const { data, error } = await admin
      .from("lessons")
      .insert({ ...parsed.data, position: (last?.position ?? 0) + 1, is_published: false })
      .select("id")
      .single();
    if (error) throw error;
    await admin.from("lesson_contents").insert({ lesson_id: data.id, summary_kk: "", summary_ru: "" });

    await audit(actor.id, "lesson.create", "lesson", data.id, parsed.data);
    refreshAdmin();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return fail(error);
  }
}

const lessonSchema = z.object({
  id: z.uuid(),
  topic_id: z.uuid(),
  title_kk: title,
  title_ru: title,
  is_free: z.boolean(),
  is_published: z.boolean(),
  duration_seconds: z.number().int().min(0).max(6 * 3600).nullable(),
  xp_reward: z.number().int().min(0).max(1000),
  youtube: z.string().trim().max(300),
  summary_kk: z.string().max(50_000),
  summary_ru: z.string().max(50_000),
});

export async function saveLesson(input: z.input<typeof lessonSchema>): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    const parsed = lessonSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const { id, youtube, summary_kk, summary_ru, ...lesson } = parsed.data;

    const youtubeId = youtube ? parseYoutubeId(youtube) : null;
    if (youtube && !youtubeId) return { ok: false, error: "invalid_input", detail: "YouTube сілтемесі танылмады." };

    const admin = createAdminClient();
    const { data, error } = await admin.from("lessons").update(lesson).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };

    const { error: contentError } = await admin.from("lesson_contents").upsert({ lesson_id: id, summary_kk, summary_ru });
    if (contentError) throw contentError;

    const { error: videoError } = youtubeId
      ? await admin.from("lesson_videos").upsert({ lesson_id: id, youtube_id: youtubeId })
      : await admin.from("lesson_videos").delete().eq("lesson_id", id);
    if (videoError) throw videoError;

    await audit(actor.id, "lesson.update", "lesson", id, { ...lesson, youtubeId });
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Оқушы бастаған сабақты өшірмейміз (прогресс жоғалады) — оның орнына жариялауды алып тастау керек. */
export async function deleteLesson(id: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();

    const { count } = await admin.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("lesson_id", id);
    if (count) return { ok: false, error: "in_use" };

    const { data, error } = await admin.from("lessons").delete().eq("id", id).select("title_kk").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };
    await audit(actor.id, "lesson.delete", "lesson", id, { title: data.title_kk });
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
