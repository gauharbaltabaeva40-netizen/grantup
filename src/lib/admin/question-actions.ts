"use server";

// Сұрақтар банкі: сұрақ/нұсқа, контекстік мәтін, сурет жүктеу, Excel/CSV импорт.

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, fail, refreshAdmin } from "./audit";
import { type ImportRow, normalizeImportRow } from "./question-import";
import type { AdminResult } from "./types";

const BUCKET = "question-images";
const imagePath = z
  .string()
  .regex(/^q\/[0-9a-f-]{36}\.(png|jpg|webp)$/)
  .nullable();

// ---------------------------------------------------------------------
// Сурет жүктеу (жабық бакет, тек service_role)
// ---------------------------------------------------------------------

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Файлдың алғашқы байттары шынымен PNG/JPEG/WebP екенін тексеру (MIME-ге ғана сенбейміз) */
function sniffImage(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function uploadQuestionImage(formData: FormData): Promise<AdminResult<{ path: string; url: string | null }>> {
  try {
    const actor = await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) {
      return { ok: false, error: "invalid_input", detail: "Сурет 2 МБ-тан аспауы керек." };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(bytes);
    if (!type) return { ok: false, error: "invalid_input", detail: "Тек PNG, JPEG немесе WebP." };

    const path = `q/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
    const storage = createAdminClient().storage.from(BUCKET);
    const { error } = await storage.upload(path, bytes, { contentType: type, upsert: false });
    if (error) throw error;
    const { data } = await storage.createSignedUrl(path, 600);

    await audit(actor.id, "question_image.upload", "storage", path, { size: file.size });
    return { ok: true, data: { path, url: data?.signedUrl ?? null } };
  } catch (error) {
    return fail(error);
  }
}

async function removeImages(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await createAdminClient().storage.from(BUCKET).remove(list);
}

// ---------------------------------------------------------------------
// Сұрақ
// ---------------------------------------------------------------------

const optionSchema = z.object({
  id: z.uuid().optional(),
  content: z.string().trim().min(1).max(2000),
  is_correct: z.boolean(),
});

const questionSchema = z
  .object({
    id: z.uuid().optional(),
    subject_id: z.number().int().positive(),
    topic_id: z.uuid().nullable(),
    group_id: z.uuid().nullable(),
    type: z.enum(["single", "multiple"]),
    locale: z.enum(["kk", "ru"]),
    difficulty: z.number().int().min(1).max(3),
    stem: z.string().trim().min(1).max(10_000),
    image_path: imagePath,
    explanation: z.string().trim().max(10_000),
    is_active: z.boolean(),
    options: z.array(optionSchema).min(2).max(8),
  })
  .refine((q) => {
    const correct = q.options.filter((o) => o.is_correct).length;
    return q.type === "single" ? correct === 1 : correct >= 1;
  }, "correct");

export type QuestionInput = z.input<typeof questionSchema>;

export async function saveQuestion(input: QuestionInput): Promise<AdminResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = questionSchema.safeParse(input);
    if (!parsed.success) {
      const correctIssue = parsed.error.issues.some((i) => i.message === "correct");
      return { ok: false, error: "invalid_input", detail: correctIssue ? "Бір жауапты сұрақта дәл 1, көп жауаптыда кемінде 1 дұрыс нұсқа болуы керек." : undefined };
    }
    const { id, options, ...question } = parsed.data;
    const admin = createAdminClient();

    // Тақырып пен контекстік мәтін осы пәнге (және тілге) тиесілі болуы керек
    if (question.topic_id) {
      const { data } = await admin.from("topics").select("subject_id").eq("id", question.topic_id).maybeSingle();
      if (data?.subject_id !== question.subject_id) return { ok: false, error: "invalid_input", detail: "Тақырып басқа пәнге жатады." };
    }
    if (question.group_id) {
      const { data } = await admin.from("question_groups").select("subject_id, locale").eq("id", question.group_id).maybeSingle();
      if (data?.subject_id !== question.subject_id || data.locale !== question.locale) {
        return { ok: false, error: "invalid_input", detail: "Контекстік мәтін басқа пәнге немесе тілге жатады." };
      }
    }

    let questionId = id;
    if (id) {
      const { data: old } = await admin.from("questions").select("image_path").eq("id", id).maybeSingle();
      if (!old) return { ok: false, error: "not_found" };
      const { error } = await admin.from("questions").update(question).eq("id", id);
      if (error) throw error;
      if (old.image_path && old.image_path !== question.image_path) await removeImages([old.image_path]);

      const { data: existing } = await admin.from("question_options").select("id").eq("question_id", id);
      const existingIds = new Set((existing ?? []).map((o) => o.id));
      if (options.some((o) => o.id && !existingIds.has(o.id))) return { ok: false, error: "invalid_input" };
      const keep = new Set(options.map((o) => o.id).filter(Boolean));
      const removed = [...existingIds].filter((x) => !keep.has(x));
      if (removed.length) {
        const { error: delError } = await admin.from("question_options").delete().in("id", removed);
        if (delError) throw delError;
      }
      // unique (question_id, position): алдымен уақытша позицияларға жылжытамыз
      for (const [i, o] of options.entries()) {
        if (!o.id) continue;
        const { error: e } = await admin.from("question_options").update({ position: 100 + i }).eq("id", o.id);
        if (e) throw e;
      }
      for (const [i, o] of options.entries()) {
        const values = { content: o.content, is_correct: o.is_correct, position: i + 1 };
        const { error: e } = o.id
          ? await admin.from("question_options").update(values).eq("id", o.id)
          : await admin.from("question_options").insert({ ...values, question_id: id });
        if (e) throw e;
      }
      await audit(actor.id, "question.update", "question", id, { type: question.type, options: options.length });
    } else {
      const { data, error } = await admin
        .from("questions")
        .insert({ ...question, source: "manual", created_by: actor.id })
        .select("id")
        .single();
      if (error) throw error;
      questionId = data.id;
      const { error: optError } = await admin
        .from("question_options")
        .insert(options.map((o, i) => ({ question_id: data.id, content: o.content, is_correct: o.is_correct, position: i + 1 })));
      if (optError) {
        await admin.from("questions").delete().eq("id", data.id);
        throw optError;
      }
      await audit(actor.id, "question.create", "question", data.id, { subject_id: question.subject_id });
    }

    refreshAdmin();
    return { ok: true, data: { id: questionId! } };
  } catch (error) {
    return fail(error);
  }
}

/** Оқушылар жауап берген немесе сынаққа кірген сұрақ өшірілмейді — оның орнына өшіріп қою (is_active = false). */
export async function deleteQuestion(id: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();

    const [{ count: answers }, { count: mocks }] = await Promise.all([
      admin.from("attempt_answers").select("question_id", { count: "exact", head: true }).eq("question_id", id),
      admin.from("mock_exam_questions").select("question_id", { count: "exact", head: true }).eq("question_id", id),
    ]);
    if (answers || mocks) return { ok: false, error: "in_use" };

    const { data, error } = await admin.from("questions").delete().eq("id", id).select("image_path").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };
    await removeImages([data.image_path]);

    await audit(actor.id, "question.delete", "question", id);
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setQuestionActive(id: string, active: boolean): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid_input" };
    const { data, error } = await createAdminClient().from("questions").update({ is_active: active }).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };
    await audit(actor.id, active ? "question.activate" : "question.deactivate", "question", id);
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------
// Контекстік мәтін (бір мәтінге бірнеше сұрақ)
// ---------------------------------------------------------------------

const groupSchema = z.object({
  id: z.uuid().optional(),
  subject_id: z.number().int().positive(),
  topic_id: z.uuid().nullable(),
  locale: z.enum(["kk", "ru"]),
  title: z.string().trim().max(200).nullable(),
  passage: z.string().trim().min(1).max(30_000),
  image_path: imagePath,
});

export async function saveQuestionGroup(input: z.input<typeof groupSchema>): Promise<AdminResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = groupSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const { id, ...values } = parsed.data;
    const admin = createAdminClient();

    if (id) {
      const { data: old } = await admin.from("question_groups").select("image_path, subject_id, locale").eq("id", id).maybeSingle();
      if (!old) return { ok: false, error: "not_found" };
      // Ішіндегі сұрақтар басқа пәнде/тілде қалып қоймауы үшін пән мен тілді өзгертуге болмайды
      if (old.subject_id !== values.subject_id || old.locale !== values.locale) {
        const { count } = await admin.from("questions").select("id", { count: "exact", head: true }).eq("group_id", id);
        if (count) return { ok: false, error: "in_use", detail: "Ішінде сұрақтар бар — пән мен тілді өзгертуге болмайды." };
      }
      const { error } = await admin.from("question_groups").update(values).eq("id", id);
      if (error) throw error;
      if (old.image_path && old.image_path !== values.image_path) await removeImages([old.image_path]);
      await audit(actor.id, "question_group.update", "question_group", id);
      refreshAdmin();
      return { ok: true, data: { id } };
    }

    const { data, error } = await admin.from("question_groups").insert(values).select("id").single();
    if (error) throw error;
    await audit(actor.id, "question_group.create", "question_group", data.id);
    refreshAdmin();
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteQuestionGroup(id: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();
    const { count } = await admin.from("questions").select("id", { count: "exact", head: true }).eq("group_id", id);
    if (count) return { ok: false, error: "in_use" };

    const { data, error } = await admin.from("question_groups").delete().eq("id", id).select("image_path").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };
    await removeImages([data.image_path]);
    await audit(actor.id, "question_group.delete", "question_group", id);
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------
// Excel/CSV импорт
// ---------------------------------------------------------------------

const MAX_IMPORT = 500;

/**
 * Клиент жіберген жолдар серверде қайта тексеріледі (сол normalizeImportRow ережесімен).
 * Бір жол қате болса — ештеңе сақталмайды. Тақырып атауы пән ішінде (қаз/орыс атауы бойынша) ізделеді.
 */
export async function importQuestions(input: { fileName: string; rows: Record<string, unknown>[] }): Promise<AdminResult<{ inserted: number }>> {
  try {
    const actor = await requireAdmin();
    if (!Array.isArray(input?.rows) || input.rows.length === 0 || input.rows.length > MAX_IMPORT) {
      return { ok: false, error: "invalid_input", detail: `1–${MAX_IMPORT} жол.` };
    }
    const fileName = String(input.fileName ?? "").slice(0, 120);
    const admin = createAdminClient();

    const [{ data: subjects }, { data: topics }] = await Promise.all([
      admin.from("subjects").select("id, code"),
      admin.from("topics").select("id, subject_id, title_kk, title_ru"),
    ]);
    const codes = (subjects ?? []).map((s) => s.code);

    const rows: (ImportRow & { subject_id: number; topic_id: string | null })[] = [];
    const errors: string[] = [];
    input.rows.forEach((raw, i) => {
      const { __line, ...cells } = raw && typeof raw === "object" ? raw : {};
      // __line — Excel-дегі жол нөмірі (клиент қосады), қате хабарында көрсетіледі
      const line = typeof __line === "number" ? __line : i + 2;
      const result = normalizeImportRow(cells, codes);
      if (!result) return;
      if (!result.row) return errors.push(`${line}-жол: ${result.errors[0]}`);
      const subjectId = subjects!.find((s) => s.code === result.row!.subject)!.id;
      let topicId: string | null = null;
      if (result.row.topic) {
        const name = result.row.topic.toLowerCase();
        const topic = (topics ?? []).find(
          (t) => t.subject_id === subjectId && (t.title_kk.toLowerCase() === name || t.title_ru.toLowerCase() === name),
        );
        if (!topic) return errors.push(`${line}-жол: тақырып табылмады «${result.row.topic}»`);
        topicId = topic.id;
      }
      rows.push({ ...result.row, subject_id: subjectId, topic_id: topicId });
    });
    if (errors.length) return { ok: false, error: "invalid_input", detail: errors.slice(0, 5).join("; ") };
    if (rows.length === 0) return { ok: false, error: "invalid_input", detail: "Жол жоқ." };

    const ids = rows.map(() => crypto.randomUUID());
    const { error } = await admin.from("questions").insert(
      rows.map((r, i) => ({
        id: ids[i],
        subject_id: r.subject_id,
        topic_id: r.topic_id,
        type: r.type,
        locale: r.locale,
        difficulty: r.difficulty,
        stem: r.stem,
        explanation: r.explanation,
        source: `import:${fileName}`,
        created_by: actor.id,
      })),
    );
    if (error) throw error;

    const { error: optError } = await admin.from("question_options").insert(
      rows.flatMap((r, i) =>
        r.options.map((content, k) => ({ question_id: ids[i], position: k + 1, content, is_correct: r.correct.includes(k) })),
      ),
    );
    if (optError) {
      await admin.from("questions").delete().in("id", ids);
      throw optError;
    }

    await audit(actor.id, "question.import", "question", "bulk", { count: rows.length, fileName });
    refreshAdmin();
    return { ok: true, data: { inserted: rows.length } };
  } catch (error) {
    return fail(error);
  }
}
