"use server";

// Прокторинг: «қате дабыл» белгісі және сертификатты әкімші беруі / жоюы.

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { issueCertificate } from "@/lib/proctoring/certificate";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit, fail, refreshAdmin } from "./audit";
import type { AdminResult } from "./types";

/** Бұзушылықты «қате дабыл» деп белгілеу (адалдық индексіне есептелмейді) немесе белгіні алу */
export async function setProctoringEventDismissed(eventId: number, dismissed: boolean): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!Number.isInteger(eventId) || eventId <= 0) return { ok: false, error: "invalid_input" };
    const { data, error } = await createAdminClient()
      .from("proctoring_events")
      .update(dismissed ? { dismissed_at: new Date().toISOString(), dismissed_by: actor.id } : { dismissed_at: null, dismissed_by: null })
      .eq("id", eventId)
      .select("attempt_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "not_found" };
    await audit(actor.id, dismissed ? "proctoring.dismiss" : "proctoring.undismiss", "attempt", data.attempt_id, { eventId });
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Сертификатты беру (индекс төмен болса да, әкімші тексеріп шешті) немесе жойылғанын қалпына келтіру */
export async function approveCertificate(attemptId: string): Promise<AdminResult<{ code: string }>> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(attemptId).success) return { ok: false, error: "invalid_input" };
    const certificate = await issueCertificate(attemptId, actor.id);
    if (!certificate) return { ok: false, error: "not_found" };
    await audit(actor.id, "certificate.approve", "attempt", attemptId, { code: certificate.code });
    refreshAdmin();
    return { ok: true, data: { code: certificate.code } };
  } catch (error) {
    return fail(error);
  }
}

/** Сертификатты жою: тексеру беті «жарамсыз» деп көрсетеді, автоматты қайта берілмейді */
export async function revokeCertificate(attemptId: string): Promise<AdminResult> {
  try {
    const actor = await requireAdmin();
    if (!z.uuid().safeParse(attemptId).success) return { ok: false, error: "invalid_input" };
    const admin = createAdminClient();
    const { data: existing } = await admin.from("certificates").select("id").eq("attempt_id", attemptId).maybeSingle();
    if (existing) {
      await admin.from("certificates").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      // Әлі берілмеген болса да — автоматты берілмеуі үшін «жойылған» жазба жасаймыз
      const issued = await issueCertificate(attemptId, actor.id);
      if (!issued) return { ok: false, error: "not_found" };
      await admin.from("certificates").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", issued.id);
    }
    await audit(actor.id, "certificate.revoke", "attempt", attemptId);
    refreshAdmin();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
