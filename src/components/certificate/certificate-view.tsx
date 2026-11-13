import Image from "next/image";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { BadgeCheck, ShieldCheck, XCircle } from "lucide-react";
import type { Certificate } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * «Прокторингпен расталған нәтиже» сертификаты (басып шығаруға/PDF-ке дайын).
 * Брендтік су белгісі: ортада өте үлкен, өте әлсіз GrantUp логотипі.
 */
export async function CertificateView({ certificate, verifyUrl, locale }: { certificate: Certificate; verifyUrl: string; locale: string }) {
  const t = await getTranslations("certificate");
  const valid = certificate.status === "valid";
  const qr = await QRCode.toString(verifyUrl, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0b1026", light: "#ffffff00" },
  });
  const date = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Almaty" }).format(
    new Date(certificate.exam_date),
  );

  return (
    <article
      data-printable
      className="relative isolate mx-auto w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white p-6 text-[#0b1026] shadow-2xl ring-1 ring-black/5 sm:p-10"
    >
      {/* Су белгісі: өте үлкен әрі өте әлсіз логотип */}
      <Image
        src="/logo.png"
        alt=""
        width={720}
        height={720}
        priority
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 w-[85%] max-w-[720px] -translate-x-1/2 -translate-y-1/2 opacity-[0.045] select-none"
      />
      {/* Жиек: жұқа градиент жолақ */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-2 bg-brand-gradient" />

      <header className="flex items-center gap-3">
        <Image src="/logo.png" alt="" width={44} height={44} className="rounded-full" />
        <span className="text-xl font-extrabold tracking-tight">
          Grant<span className="text-brand-gradient">Up</span>.kz
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-extrabold",
            valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700",
          )}
        >
          {valid ? <BadgeCheck className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
          {valid ? t("valid") : t("revoked")}
        </span>
      </header>

      <div className="mt-8 text-center sm:mt-10">
        <p className="text-sm font-extrabold tracking-[0.25em] text-slate-500 uppercase">{t("title")}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-balance sm:text-4xl">{t("heading")}</h1>
        <p className="mt-6 text-sm font-semibold text-slate-500">{t("issuedTo")}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight sm:text-5xl">{certificate.student_name}</p>
      </div>

      <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-sm font-bold text-slate-500">{t("examTitle")}</p>
          <p className="text-5xl font-extrabold tabular-nums">
            {fmt(Number(certificate.score))}
            <span className="text-2xl text-slate-400"> / {fmt(Number(certificate.max_score))}</span>
          </p>
          {certificate.sections.length > 0 && (
            <table className="mt-4 w-full max-w-md text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 font-bold">{t("section")}</th>
                  <th className="py-1.5 text-right font-bold">{t("score")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {certificate.sections.map((s) => (
                  <tr key={s.title} className="border-b border-slate-100">
                    <td className="py-1.5 font-semibold">{s.title}</td>
                    <td className="py-1.5 text-right">
                      {fmt(s.score)} / {fmt(s.max)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-sm font-bold text-sky-800">
            <ShieldCheck className="size-4" aria-hidden />
            {t("proctored")}
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 sm:items-end">
          <div className="size-32 rounded-xl bg-white p-2 ring-1 ring-slate-200 sm:size-36" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-xs text-slate-500">
            {t("code")}: <span className="font-mono font-bold tracking-wider text-[#0b1026]">{certificate.code}</span>
          </p>
          <p className="text-xs text-slate-500">
            {t("date")}: <span className="font-semibold text-[#0b1026]">{date}</span>
          </p>
        </div>
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        <p>
          {t("verifyAt")}: <span className="font-mono break-all">{verifyUrl}</span>
        </p>
        <p className="mt-1">{t("disclaimer")}</p>
      </footer>
    </article>
  );
}
