import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppLocale, Certificate } from "@/lib/supabase/types";
import { CERT_MIN_INTEGRITY, integrityIndex } from "./integrity";

// «Прокторингпен расталған нәтиже» сертификаттары.
// Адалдық индексі жеткілікті болса — автоматты беріледі; болмаса — әкімші тексеріп, өзі береді немесе жояды.

/** Шатастырмайтын таңбалар (0/O, 1/I жоқ) */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function certificateCode() {
  return Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");
}

/** Сынақтың адалдық индексі (тек әкімшіге көрсетіледі); null — камерасыз өткен */
export async function attemptIntegrity(attemptId: string): Promise<number | null> {
  const { data } = await createAdminClient()
    .from("proctoring_events")
    .select("type, dismissed_at")
    .eq("attempt_id", attemptId)
    .limit(2000);
  return integrityIndex(data ?? []);
}

export async function getCertificate(attemptId: string): Promise<Certificate | null> {
  const { data } = await createAdminClient().from("certificates").select("*").eq("attempt_id", attemptId).maybeSingle();
  return (data as Certificate | null) ?? null;
}

export async function getCertificateByCode(code: string): Promise<Certificate | null> {
  if (!/^[A-Z2-9]{10}$/.test(code)) return null;
  const { data } = await createAdminClient().from("certificates").select("*").eq("code", code).maybeSingle();
  return (data as Certificate | null) ?? null;
}

/**
 * Сертификат беру (немесе жойылғанын қайта жарамды ету). Сынақ аяқталған ҰБТ болуы керек.
 * Нәтиже мен аты-жөні осы сәттегі күйімен сақталады.
 */
export async function issueCertificate(attemptId: string, issuedBy: string | null): Promise<Certificate | null> {
  const admin = createAdminClient();
  const existing = await getCertificate(attemptId);
  if (existing) {
    if (existing.status === "valid" || !issuedBy) return existing;
    const { data } = await admin
      .from("certificates")
      .update({ status: "valid", revoked_at: null, issued_by: issuedBy })
      .eq("id", existing.id)
      .select("*")
      .single();
    return data as Certificate;
  }

  const { data: attempt } = await admin
    .from("attempts")
    .select("id, user_id, kind, status, locale, score, max_score, section_scores, structure, finished_at, started_at")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.kind !== "mock" || !["finished", "expired"].includes(attempt.status) || attempt.score == null) return null;

  const [{ data: profile }, { data: subjects }] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", attempt.user_id).maybeSingle(),
    admin.from("subjects").select("code, title_kk, title_ru"),
  ]);
  const locale = attempt.locale as AppLocale;
  const titleOf = new Map((subjects ?? []).map((s) => [s.code, locale === "ru" ? s.title_ru : s.title_kk]));
  const layout = (attempt.structure as { layout?: { subject: string }[] } | null)?.layout ?? [];
  const scores = (attempt.section_scores ?? {}) as Record<string, { score: number; max: number }>;
  const order = [...layout.map((l) => l.subject), ...Object.keys(scores).filter((c) => !layout.some((l) => l.subject === c))];
  const sections = order
    .filter((code) => scores[code])
    .map((code) => ({ title: titleOf.get(code) ?? code, score: Number(scores[code].score), max: Number(scores[code].max) }));

  for (let i = 0; i < 5; i++) {
    const { data, error } = await admin
      .from("certificates")
      .insert({
        code: certificateCode(),
        attempt_id: attempt.id,
        user_id: attempt.user_id,
        student_name: profile?.full_name?.trim() || "GrantUp",
        score: Number(attempt.score),
        max_score: Number(attempt.max_score),
        sections,
        exam_date: attempt.finished_at ?? attempt.started_at,
        issued_by: issuedBy,
      })
      .select("*")
      .single();
    if (data) return data as Certificate;
    // Бір мезетте екі сұраныс — бұрын жасалғанын қайтарамыз; код қайталанса — қайта көреміз
    if (error?.code === "23505") {
      const again = await getCertificate(attemptId);
      if (again) return again;
      continue;
    }
    throw error;
  }
  return null;
}

export type CertificateStatus =
  | { state: "issued"; certificate: Certificate }
  | { state: "revoked" }
  | { state: "pending" } //      индекс жеткіліксіз — әкімші тексереді
  | { state: "not_proctored" };

/** Оқушы үшін: бұрын берілгенін қайтарады немесе индекс жеткілікті болса автоматты береді */
export async function certificateForStudent(attemptId: string): Promise<CertificateStatus> {
  const existing = await getCertificate(attemptId);
  if (existing) return existing.status === "valid" ? { state: "issued", certificate: existing } : { state: "revoked" };

  const index = await attemptIntegrity(attemptId);
  if (index === null) return { state: "not_proctored" };
  if (index < CERT_MIN_INTEGRITY) return { state: "pending" };
  const certificate = await issueCertificate(attemptId, null);
  return certificate ? { state: "issued", certificate } : { state: "pending" };
}
