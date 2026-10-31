"use server";

// Админ әрекеттері. Әрқайсысы: requireAdmin → service_role арқылы өзгеріс → audit_log.
// 12-кезеңде толық админ-панель осы функцияларды қолданады (CSV импорт т.б. сонда қосылады).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { emailSchema } from "@/lib/auth/schemas";
import { AuthError, requireAdmin } from "@/lib/auth/session";
import { CODE_TTL_HOURS, generateCode, hashCode, MAX_DEVICES } from "@/lib/device/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminErrorKey = "forbidden" | "invalid_input" | "not_found" | "choose_device" | "unknown";

export type AdminResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: AdminErrorKey };

async function audit(actorId: string, action: string, targetType: string, targetId: string, meta = {}) {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, meta });
  if (error) console.error("audit insert failed", error);
}

function fail(error: unknown): { ok: false; error: "forbidden" | "unknown" } {
  if (error instanceof AuthError) return { ok: false, error: "forbidden" };
  console.error("admin action failed", error);
  return { ok: false, error: "unknown" };
}

// ---------------------------------------------------------------------
// Құрылғы сұраныстары
// ---------------------------------------------------------------------

/**
 * Сұранысқа рұқсат беру: 6 таңбалы код жасалады және ТЕК осы жауапта бір рет қайтарылады
 * (дерекқорда тек хэші). Админ кодты оқушыға платформадан тыс жеткізеді.
 * Оқушыда 2 белсенді құрылғы болса, қайсысын өшіретінін таңдау міндетті.
 */
export async function approveDeviceRequest(
  requestId: string,
  replaceDeviceId: string | null,
): Promise<AdminResult<{ code: string; expiresAt: string }>> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "invalid_input" };
    if (replaceDeviceId && !z.uuid().safeParse(replaceDeviceId).success) return { ok: false, error: "invalid_input" };

    const admin = createAdminClient();
    const { data: request } = await admin
      .from("device_requests")
      .select("id, user_id, status")
      .eq("id", requestId)
      .in("status", ["pending", "approved", "blocked"])
      .maybeSingle();
    if (!request) return { ok: false, error: "not_found" };

    const { data: active } = await admin
      .from("devices")
      .select("id")
      .eq("user_id", request.user_id)
      .is("revoked_at", null);
    const activeIds = (active ?? []).map((d) => d.id);

    if (replaceDeviceId && !activeIds.includes(replaceDeviceId)) return { ok: false, error: "invalid_input" };
    if (!replaceDeviceId && activeIds.length >= MAX_DEVICES) return { ok: false, error: "choose_device" };

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_HOURS * 3600_000).toISOString();
    const { error } = await admin
      .from("device_requests")
      .update({
        status: "approved",
        code_hash: hashCode(request.id, code),
        code_expires_at: expiresAt,
        failed_attempts: 0,
        replace_device_id: replaceDeviceId,
        decided_by: actor.id,
        decided_at: new Date().toISOString(),
      })
      .eq("id", request.id);
    if (error) throw error;

    await audit(actor.id, "device_request.approve", "device_request", request.id, {
      userId: request.user_id,
      replaceDeviceId,
    });
    revalidatePath("/admin/devices");
    return { ok: true, data: { code, expiresAt } };
  } catch (error) {
    return fail(error);
  }
}

export async function rejectDeviceRequest(requestId: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "invalid_input" };

    const { data, error } = await createAdminClient()
      .from("device_requests")
      .update({ status: "rejected", code_hash: null, decided_by: actor.id, decided_at: new Date().toISOString() })
      .eq("id", requestId)
      .in("status", ["pending", "approved", "blocked"])
      .select("user_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };

    await audit(actor.id, "device_request.reject", "device_request", requestId, { userId: data.user_id });
    revalidatePath("/admin/devices");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeDevice(deviceId: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(deviceId).success) return { ok: false, error: "invalid_input" };

    const { data, error } = await createAdminClient()
      .from("devices")
      .update({ revoked_at: new Date().toISOString(), revoked_by: actor.id })
      .eq("id", deviceId)
      .is("revoked_at", null)
      .select("user_id, label")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };

    await audit(actor.id, "device.revoke", "device", deviceId, { userId: data.user_id, label: data.label });
    revalidatePath("/admin/devices");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------
// Доступ
// ---------------------------------------------------------------------

const grantSchema = z
  .object({
    email: emailSchema,
    startsAt: z.iso.date(),
    endsAt: z.iso.date(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { path: ["endsAt"] });

/** Күн → Asia/Almaty уақыты бойынша тәуліктің басы (UTC+5). */
function almatyDayStart(date: string) {
  return new Date(`${date}T00:00:00+05:00`).toISOString();
}

/**
 * Email бойынша толық доступ беру. Email әлі тіркелмеген болса да болады —
 * тіркелгенде триггер доступты аккаунтқа автоматты байлайды.
 * Аяқталу күні қоса есептеледі (сол күннің соңына дейін).
 */
export async function grantAccess(input: {
  email: string;
  startsAt: string;
  endsAt: string;
  note?: string;
}): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    const parsed = grantSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "invalid_input" };
    const { email, startsAt, endsAt, note } = parsed.data;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    const endExclusive = new Date(new Date(almatyDayStart(endsAt)).getTime() + 24 * 3600_000).toISOString();

    const { data, error } = await admin
      .from("access_grants")
      .insert({
        email,
        user_id: profile?.id ?? null,
        starts_at: almatyDayStart(startsAt),
        ends_at: endExclusive,
        granted_by: actor.id,
        note: note || null,
      })
      .select("id")
      .single();
    if (error) throw error;

    await audit(actor.id, "access.grant", "access_grant", data.id, { email, startsAt, endsAt });
    revalidatePath("/admin/access");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function extendAccess(grantId: string, endsAt: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(grantId).success || !z.iso.date().safeParse(endsAt).success) {
      return { ok: false, error: "invalid_input" };
    }
    const endExclusive = new Date(new Date(almatyDayStart(endsAt)).getTime() + 24 * 3600_000).toISOString();

    const { data, error } = await createAdminClient()
      .from("access_grants")
      .update({ ends_at: endExclusive, revoked_at: null })
      .eq("id", grantId)
      .lt("starts_at", endExclusive)
      .select("email")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "invalid_input" };

    await audit(actor.id, "access.extend", "access_grant", grantId, { email: data.email, endsAt });
    revalidatePath("/admin/access");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeAccess(grantId: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(grantId).success) return { ok: false, error: "invalid_input" };

    const { data, error } = await createAdminClient()
      .from("access_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", grantId)
      .is("revoked_at", null)
      .select("email")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };

    await audit(actor.id, "access.revoke", "access_grant", grantId, { email: data.email });
    revalidatePath("/admin/access");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
