"use server";

// Сынақ ҰБТ прокторингі: оқиғаларды тіркеу және камера фотосын сақтау.
// Тек өз, жүріп жатқан сынақ ҰБТ-сына; бұзушылық тек журналға жазылады — сынақ тоқтатылмайды.

import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProctoringEventType } from "@/lib/supabase/types";
import { SNAPSHOT_MAX_BYTES } from "./constants";

const BUCKET = "proctoring";
const EVENT_TYPES = ["consent", "snapshot", "no_face", "multiple_faces", "camera_off", "tab_hidden", "detector_unavailable"] as const;
const IMAGE_TYPES = ["consent", "snapshot", "no_face", "multiple_faces"] as const;

/** Пайдаланушының жүріп жатқан сынақ ҰБТ-сы ма */
async function isOwnActiveMock(attemptId: string, userId: string) {
  const { data } = await createAdminClient()
    .from("attempts")
    .select("id")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("kind", "mock")
    .eq("status", "in_progress")
    .maybeSingle();
  return Boolean(data);
}

export async function logProctoringEvent(
  attemptId: string,
  type: ProctoringEventType,
  detail: Record<string, string | number | boolean> = {},
): Promise<{ ok: boolean }> {
  try {
    const user = await requireUser();
    const parsed = z
      .object({
        attemptId: z.uuid(),
        type: z.enum(EVENT_TYPES),
        detail: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).refine((d) => Object.keys(d).length <= 10),
      })
      .safeParse({ attemptId, type, detail });
    if (!parsed.success) return { ok: false };
    if (!(await rateLimit(`proctor:event:${attemptId}`, 400, 5 * 3600))) return { ok: false };
    if (!(await isOwnActiveMock(attemptId, user.id))) return { ok: false };

    const { error } = await createAdminClient()
      .from("proctoring_events")
      .insert({ attempt_id: attemptId, user_id: user.id, type: parsed.data.type, detail: parsed.data.detail });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error("logProctoringEvent failed", error);
    return { ok: false };
  }
}

/** Камера фотосы (JPEG). Себебі: келісім, кезекті фото немесе бұзушылық сәті. */
export async function uploadProctoringSnapshot(formData: FormData): Promise<{ ok: boolean }> {
  try {
    const user = await requireUser();
    const attemptId = String(formData.get("attemptId") ?? "");
    const reason = String(formData.get("reason") ?? "");
    const file = formData.get("file");
    if (!z.uuid().safeParse(attemptId).success || !(IMAGE_TYPES as readonly string[]).includes(reason)) return { ok: false };
    if (!(file instanceof File) || file.size === 0 || file.size > SNAPSHOT_MAX_BYTES) return { ok: false };

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Шынымен JPEG пе (MIME-ге ғана сенбейміз)
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return { ok: false };

    if (!(await rateLimit(`proctor:image:${attemptId}`, 150, 5 * 3600))) return { ok: false };
    if (!(await isOwnActiveMock(attemptId, user.id))) return { ok: false };

    const admin = createAdminClient();
    const path = `${user.id}/${attemptId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;

    const { error } = await admin
      .from("proctoring_events")
      .insert({ attempt_id: attemptId, user_id: user.id, type: reason as ProctoringEventType, image_path: path });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error("uploadProctoringSnapshot failed", error);
    return { ok: false };
  }
}
