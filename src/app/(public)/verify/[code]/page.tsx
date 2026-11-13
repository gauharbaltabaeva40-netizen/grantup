import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { CertificateActions } from "@/components/certificate/certificate-actions";
import { CertificateView } from "@/components/certificate/certificate-view";
import { siteUrl } from "@/lib/env";
import { getCertificateByCode } from "@/lib/proctoring/certificate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("certificate");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

// Ашық тексеру беті: QR-код осында әкеледі. Кіру қажет емес; тек сертификаттағы деректер көрсетіледі.
export default async function VerifyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [t, locale, certificate] = await Promise.all([getTranslations("certificate"), getLocale(), getCertificateByCode(code.toUpperCase())]);
  const url = `${siteUrl}/verify/${code.toUpperCase()}`;

  return (
    <div className="min-h-dvh bg-background px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link href="/" className="inline-block text-sm font-bold text-primary print:hidden">
          ← GrantUp.kz
        </Link>
        {certificate ? (
          <>
            <CertificateView certificate={certificate} verifyUrl={url} locale={locale} />
            {certificate.status === "valid" && <CertificateActions url={url} />}
          </>
        ) : (
          <div className="rounded-3xl bg-card p-10 text-center shadow-soft">
            <SearchX className="mx-auto size-10 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-semibold">{t("notFound")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
