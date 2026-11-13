import Image from "next/image";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { BadgeCheck, ShieldCheck, XCircle } from "lucide-react";
import type { Certificate } from "@/lib/supabase/types";
import { Stamp } from "@/components/brand/pen-marks";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * «Прокторингпен расталған нәтиже» сертификаты (басып шығаруға/PDF-ке дайын).
 * Брендтік су белгісі: ортада өте үлкен, өте әлсіз GrantUp логотипі.
 * «Емтихан қағазы» стилі: ақшыл қағаз, қос жиек (диплом сияқты), serif тақырыптар, қызыл «РАСТАЛДЫ» мөрі.
 */
export async function CertificateView({ certificate, verifyUrl, locale }: { certificate: Certificate; verifyUrl: string; locale: string }) {
  const t = await getTranslations("certificate");
  const valid = certificate.status === "valid";
  const qr = await QRCode.toString(verifyUrl, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#14213d", light: "#ffffff00" },
  });
  const date = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Almaty" }).format(
    new Date(certificate.exam_date),
  );

  return (
    <article
      data-printable
      className="relative isolate mx-auto w-full max-w-4xl overflow-hidden rounded-lg bg-[#fffdf8] p-8 text-[#14213d] shadow-2xl ring-1 ring-[#e6dfcd] sm:p-12"
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
      {/* Диплом сияқты қос жиек */}
      <div aria-hidden className="pointer-events-none absolute inset-3 rounded-sm border-2 border-[#14213d]/80 sm:inset-4" />
      <div aria-hidden className="pointer-events-none absolute inset-[18px] rounded-sm border border-[#14213d]/30 sm:inset-[22px]" />

      <header className="flex items-center gap-3">
        <Image src="/logo.png" alt="" width={44} height={44} className="rounded-full" />
        <span className="text-xl font-extrabold tracking-tight">
          Grant<span className="text-[#c8371f]">Up</span>.kz
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
        <p className="text-sm font-extrabold tracking-[0.3em] text-[#c8371f] uppercase">{t("title")}</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-balance sm:text-4xl">{t("heading")}</h1>
        <p className="mt-6 text-sm font-semibold text-[#5c6276]">{t("issuedTo")}</p>
        <p className="mx-auto mt-1 w-fit border-b-2 border-dashed border-[#c9c0aa] px-4 pb-1 font-serif text-3xl font-bold tracking-tight sm:text-5xl">{certificate.student_name}</p>
      </div>

      <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="text-sm font-bold text-[#5c6276]">{t("examTitle")}</p>
          <p className="font-serif text-5xl font-bold tabular-nums">
            {fmt(Number(certificate.score))}
            <span className="text-2xl text-[#8a8f9e]"> / {fmt(Number(certificate.max_score))}</span>
          </p>
          {certificate.sections.length > 0 && (
            <table className="mt-4 w-full max-w-md text-sm">
              <thead>
                <tr className="border-b border-[#e6dfcd] text-left text-xs text-[#5c6276]">
                  <th className="py-1.5 font-bold">{t("section")}</th>
                  <th className="py-1.5 text-right font-bold">{t("score")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {certificate.sections.map((s) => (
                  <tr key={s.title} className="border-b border-[#efe9da]">
                    <td className="py-1.5 font-semibold">{s.title}</td>
                    <td className="py-1.5 text-right">
                      {fmt(s.score)} / {fmt(s.max)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#ebeef7] px-3 py-1 text-sm font-bold text-[#1d3a8a]">
            <ShieldCheck className="size-4" aria-hidden />
            {t("proctored")}
          </p>
        </div>

        <div className="relative flex flex-col items-center gap-2 sm:items-end">
          {/* Қызыл «РАСТАЛДЫ» мөрі — QR-дың сол жағында, нәтиже үстінде */}
          {valid && <Stamp label={t("stamp")} sub={t("stampSub")} rotate={-12} className="absolute top-2 -left-36 hidden size-32 text-[#c8371f] sm:grid" />}
          <div className="size-32 rounded-xl bg-white p-2 ring-1 ring-[#e6dfcd] sm:size-36" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-xs text-[#5c6276]">
            {t("code")}: <span className="font-mono font-bold tracking-wider text-[#14213d]">{certificate.code}</span>
          </p>
          <p className="text-xs text-[#5c6276]">
            {t("date")}: <span className="font-semibold text-[#14213d]">{date}</span>
          </p>
        </div>
      </div>

      <footer className="mt-8 border-t border-[#e6dfcd] pt-4 text-xs leading-relaxed text-[#5c6276]">
        <p>
          {t("verifyAt")}: <span className="font-mono break-all">{verifyUrl}</span>
        </p>
        <p className="mt-1">{t("disclaimer")}</p>
      </footer>
    </article>
  );
}
