"use server";

// Платформа баптаулары (app_settings) және мамандықтар (грант шекті балдары).

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, fail, refreshAdmin } from "./audit";
import { isSettingKey, validateSetting } from "./settings-schemas";
import type { AdminResult } from "./types";

export async function saveSetting(key: string, text: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!isSettingKey(key) || typeof text !== "string" || text.length > 100_000) return { ok: false, error: "invalid_input" };
    const result = validateSetting(key, text);
    if (!result.ok) return { ok: false, error: "invalid_input", detail: result.message };

    const { data, error } = await createAdminClient()
      .from("app_settings")
      .update({ value: result.value as never, updated_by: actor.id })
      .eq("key", key)
      .select("key")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };

    await audit(actor.id, "setting.update", "app_setting", key);
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const specialtySchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-ZА-Я0-9-]{2,12}$/),
  name_kk: z.string().trim().min(1).max(200),
  name_ru: z.string().trim().min(1).max(200),
  subject_pair: z.string().trim().regex(/^[a-z_]+$/),
  threshold_score: z.number().int().min(0).max(140),
  year: z.number().int().min(2000).max(2100),
  is_active: z.boolean(),
});

export async function saveSpecialty(input: z.input<typeof specialtySchema>): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    const parsed = specialtySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const { id, ...values } = parsed.data;
    const admin = createAdminClient();

    if (id) {
      const { data, error } = await admin.from("specialties").update(values).eq("id", id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return { ok: false, error: "not_found" };
      await audit(actor.id, "specialty.update", "specialty", id, values);
    } else {
      const { data, error } = await admin.from("specialties").insert(values).select("id").single();
      if (error) throw error;
      await audit(actor.id, "specialty.create", "specialty", data.id, values);
    }
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Оқушылар мақсат ретінде таңдаған мамандық өшірілмейді — оның орнына белсенді емес етіңіз. */
export async function deleteSpecialty(id: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("target_specialty_id", id);
    if (count) return { ok: false, error: "in_use" };

    const { data, error } = await admin.from("specialties").delete().eq("id", id).select("code").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };
    await audit(actor.id, "specialty.delete", "specialty", id, { code: data.code });
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
