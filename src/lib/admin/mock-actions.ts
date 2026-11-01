"use server";

// Сынақ ҰБТ варианттары: құрылым бойынша автоматты құрастыру, жариялау, сұрақты ауыстыру.

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { cryptoRandom } from "@/lib/quiz/server";
import { getSetting, type UntStructure } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, fail, refreshAdmin } from "./audit";
import { KIND_LABEL, pickSection, type PoolQuestion } from "./mock-builder";
import type { AdminResult } from "./types";

const title = z.string().trim().min(1).max(200);

async function usageCounts(questionIds: string[]) {
  const usage = new Map<string, number>();
  for (let i = 0; i < questionIds.length; i += 500) {
    const { data } = await createAdminClient().from("mock_exam_questions").select("question_id").in("question_id", questionIds.slice(i, i + 500));
    for (const row of data ?? []) usage.set(row.question_id, (usage.get(row.question_id) ?? 0) + 1);
  }
  return usage;
}

const createSchema = z.object({ title_kk: title, title_ru: title, locale: z.enum(["kk", "ru"]), is_free: z.boolean(), allowPartial: z.boolean() });

/**
 * Ағымдағы ҰБТ құрылымы (app_settings.unt_structure) бойынша жаңа вариант. Басқа варианттарда аз қолданылған сұрақтар бірінші алынады.
 * Сұрақ жетпесе — allowPartial болмаса жасалмайды; жасалса да, толық болмайынша жариялау мүмкін емес.
 */
export async function createMockExam(input: z.input<typeof createSchema>): Promise<AdminResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const { allowPartial, ...values } = parsed.data;
    const admin = createAdminClient();
    const structure = await getSetting("unt_structure");

    const { data: subjects } = await admin.from("subjects").select("id, code, title_kk");
    const picked: { subjectId: number; ids: string[] }[] = [];
    const problems: string[] = [];

    for (const section of structure.sections) {
      const subject = subjects?.find((s) => s.code === section.subject);
      if (!subject) {
        problems.push(`${section.subject}: пән жоқ`);
        continue;
      }
      const { data: pool } = await admin
        .from("questions")
        .select("id, type, group_id")
        .eq("subject_id", subject.id)
        .eq("locale", values.locale)
        .eq("is_active", true)
        .limit(5000);
      const usage = await usageCounts((pool ?? []).map((q) => q.id));
      const { ids, shortages } = pickSection((pool ?? []) as PoolQuestion[], section.composition, usage, cryptoRandom);
      for (const s of shortages) problems.push(`${subject.title_kk}: ${KIND_LABEL[s.kind]} ${s.have}/${s.need}`);
      picked.push({ subjectId: subject.id, ids });
    }

    if (problems.length && !allowPartial) return { ok: false, error: "not_enough", detail: problems.join("; ") };
    if (picked.every((p) => p.ids.length === 0)) return { ok: false, error: "not_enough", detail: problems.join("; ") };

    const { data: mock, error } = await admin
      .from("mock_exams")
      .insert({ ...values, is_published: false, structure: structure as never, created_by: actor.id })
      .select("id")
      .single();
    if (error) throw error;

    const { error: itemsError } = await admin
      .from("mock_exam_questions")
      .insert(picked.flatMap((p) => p.ids.map((questionId, i) => ({ mock_exam_id: mock.id, question_id: questionId, subject_id: p.subjectId, position: i + 1 }))));
    if (itemsError) {
      await admin.from("mock_exams").delete().eq("id", mock.id);
      throw itemsError;
    }

    await audit(actor.id, "mock.create", "mock_exam", mock.id, { locale: values.locale, partial: problems.length > 0 });
    refreshAdmin();
    return { ok: true, data: { id: mock.id } };
  } catch (error) {
    return fail(error);
  }
}

/** Вариант құрылымға толық сай ма: әр пәнде сұрақ саны дәл structure.sections[].questions */
async function completeness(mockId: string, structure: UntStructure) {
  const admin = createAdminClient();
  const [{ data: items }, { data: subjects }] = await Promise.all([
    admin.from("mock_exam_questions").select("question_id, subject_id").eq("mock_exam_id", mockId),
    admin.from("subjects").select("id, code, title_kk"),
  ]);
  const { data: active } = await admin
    .from("questions")
    .select("id")
    .in("id", (items ?? []).map((i) => i.question_id))
    .eq("is_active", true);
  const activeIds = new Set((active ?? []).map((q) => q.id));
  const problems: string[] = [];
  for (const section of structure.sections) {
    const subject = subjects?.find((s) => s.code === section.subject);
    const count = (items ?? []).filter((i) => i.subject_id === subject?.id && activeIds.has(i.question_id)).length;
    if (count !== section.questions) problems.push(`${subject?.title_kk ?? section.subject}: ${count}/${section.questions}`);
  }
  return problems;
}

const updateSchema = z.object({ id: z.uuid(), title_kk: title, title_ru: title, is_free: z.boolean(), is_published: z.boolean() });

export async function updateMockExam(input: z.input<typeof updateSchema>): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const { id, ...values } = parsed.data;
    const admin = createAdminClient();

    const { data: mock } = await admin.from("mock_exams").select("structure").eq("id", id).maybeSingle();
    if (!mock) return { ok: false, error: "not_found" };
    if (values.is_published) {
      const problems = await completeness(id, mock.structure as unknown as UntStructure);
      if (problems.length) return { ok: false, error: "not_enough", detail: `Жариялау үшін вариант толық болуы керек: ${problems.join("; ")}` };
    }

    const { error } = await admin.from("mock_exams").update(values).eq("id", id);
    if (error) throw error;
    await audit(actor.id, "mock.update", "mock_exam", id, values);
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Бір жеке сұрақты (контекстік емес) осы пәннің, осы түрдің, осы вариантта жоқ басқа сұрағымен ауыстыру.
 * Басталған сынақтарға әсер етпейді — олар өз сұрақ тізімін attempt.question_ids-те сақтайды.
 */
export async function replaceMockQuestion(mockId: string, questionId: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(mockId).success || !z.uuid().safeParse(questionId).success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();

    const [{ data: mock }, { data: current }] = await Promise.all([
      admin.from("mock_exams").select("locale").eq("id", mockId).maybeSingle(),
      admin.from("questions").select("subject_id, type, group_id").eq("id", questionId).maybeSingle(),
    ]);
    if (!mock || !current) return { ok: false, error: "not_found" };
    if (current.group_id) return { ok: false, error: "invalid_input", detail: "Контекстік сұрақ мәтінімен бірге ауыстырылады." };

    const { data: items } = await admin.from("mock_exam_questions").select("question_id").eq("mock_exam_id", mockId);
    const inMock = new Set((items ?? []).map((i) => i.question_id));
    const { data: pool } = await admin
      .from("questions")
      .select("id, type, group_id")
      .eq("subject_id", current.subject_id)
      .eq("locale", mock.locale)
      .eq("type", current.type)
      .is("group_id", null)
      .eq("is_active", true)
      .limit(5000);
    const candidates = (pool ?? []).filter((q) => !inMock.has(q.id)) as PoolQuestion[];
    const { ids } = pickSection(candidates, { [current.type]: 1 }, await usageCounts(candidates.map((c) => c.id)), cryptoRandom);
    if (!ids.length) return { ok: false, error: "not_enough", detail: "Ауыстыратын бос сұрақ жоқ." };

    const { error } = await admin.from("mock_exam_questions").update({ question_id: ids[0] }).eq("mock_exam_id", mockId).eq("question_id", questionId);
    if (error) throw error;
    await audit(actor.id, "mock.replace_question", "mock_exam", mockId, { from: questionId, to: ids[0] });
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Тапсырылған вариант өшірілмейді (оқушылардың нәтижелері сақталуы керек) — оның орнына жариялауды алып тастаңыз. */
export async function deleteMockExam(id: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();
    const { count } = await admin.from("attempts").select("id", { count: "exact", head: true }).eq("mock_exam_id", id);
    if (count) return { ok: false, error: "in_use" };

    const { data, error } = await admin.from("mock_exams").delete().eq("id", id).select("title_kk").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };
    await audit(actor.id, "mock.delete", "mock_exam", id, { title: data.title_kk });
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
