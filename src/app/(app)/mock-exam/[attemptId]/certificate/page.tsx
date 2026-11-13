import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ArrowLeft, BadgeCheck, ExternalLink, Hourglass, VideoOff, XCircle } from "lucide-react";
import { CertificateActions } from "@/components/certificate/certificate-actions";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { certificateForStudent } from "@/lib/proctoring/certificate";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata() {
  const t = await getTranslations("certificate");
  return { title: t("pageTitle") };
}

export const dynamic = "force-dynamic";

// Оқушы: өз сынағының сертификаты. Адалдық индексі мұнда көрсетілмейді (тек әкімшіге).
export default async function StudentCertificatePage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) notFound();
  const user = await getSessionUser();
  if (!user) notFound();

  const { data: attempt } = await createAdminClient()
    .from("attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .eq("kind", "mock")
    .maybeSingle();
  if (!attempt || !["finished", "expired"].includes(attempt.status)) notFound();

  const [t, status] = await Promise.all([getTranslations("certificate"), certificateForStudent(attemptId)]);
  const url = status.state === "issued" ? `${siteUrl}/verify/${status.certificate.code}` : "";

  const info = {
    issued: { icon: BadgeCheck, tone: "bg-success/12 text-success", text: t("shareHint") },
    pending: { icon: Hourglass, tone: "bg-streak/15 text-amber-700 dark:text-amber-300", text: t("pending") },
    revoked: { icon: XCircle, tone: "bg-danger/10 text-danger", text: t("revokedStudent") },
    not_proctored: { icon: VideoOff, tone: "bg-muted text-muted-foreground", text: t("notProctored") },
  }[status.state];
  const Icon = info.icon;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href={`/mock-exam/${attemptId}/result`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t("back")}
      </Link>
      <div className="rounded-3xl bg-card p-6 text-center shadow-soft sm:p-8">
        <span className={`mx-auto grid size-16 place-items-center rounded-2xl ${info.tone}`}>
          <Icon className="size-8" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{t("heading")}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{info.text}</p>
        {status.state === "issued" && (
          <div className="mt-6 space-y-3">
            <Link href={`/verify/${status.certificate.code}`} target="_blank" className={buttonVariants({ variant: "brand", size: "xl", className: "w-full" })}>
              <ExternalLink aria-hidden /> {t("open")}
            </Link>
            <CertificateActions url={url} />
          </div>
        )}
      </div>
    </div>
  );
}
