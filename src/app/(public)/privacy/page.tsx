import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalPage } from "@/components/public/legal-page";
import { LEGAL } from "@/content/legal";
import type { Locale } from "@/i18n/config";

const PATH = "/privacy";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const doc = LEGAL[locale].privacy;
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: locale === "ru" ? `/ru${PATH}` : PATH, languages: { kk: PATH, ru: `/ru${PATH}`, "x-default": PATH } },
  };
}

export default async function Page() {
  const locale = (await getLocale()) as Locale;
  return <LegalPage doc={LEGAL[locale].privacy} locale={locale} path={PATH} />;
}
