// Адалдық индексі (0–100) — тек әкімшіге көрінеді.
// 100-ден бастап әр бұзушылық үшін балл азаяды. Әкімші «қате дабыл» деп белгілеген оқиғалар есептелмейді.

import type { ProctoringEventType } from "@/lib/supabase/types";

/** Бір оқиғаның «бағасы» (бір түрлі оқиға минутына бір реттен жиі тіркелмейді) */
export const INTEGRITY_PENALTY: Partial<Record<ProctoringEventType, number>> = {
  multiple_faces: 15,
  phone_detected: 15,
  camera_off: 10,
  no_face: 8,
  tab_hidden: 6,
  looking_away: 5,
};

/** Осыдан жоғары болса, сертификат автоматты беріледі; төмен болса — әкімші тексеріп, өзі береді */
export const CERT_MIN_INTEGRITY = 80;

export type IntegrityEvent = { type: ProctoringEventType; dismissed_at?: string | null };

/** null — сынақ камерамен өтпеген (келісім/фото оқиғасы жоқ), индекс есептелмейді */
export function integrityIndex(events: readonly IntegrityEvent[]): number | null {
  const proctored = events.some((e) => e.type === "consent" || e.type === "snapshot");
  if (!proctored) return null;
  const penalty = events.reduce((sum, e) => (e.dismissed_at ? sum : sum + (INTEGRITY_PENALTY[e.type] ?? 0)), 0);
  return Math.max(0, 100 - penalty);
}

export function integrityTone(index: number | null): "good" | "warn" | "bad" | "none" {
  if (index === null) return "none";
  if (index >= 90) return "good";
  if (index >= 70) return "warn";
  return "bad";
}
