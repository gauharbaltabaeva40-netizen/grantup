import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MailCheck } from "lucide-react";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("checkEmailTitle") };
}

export default async function CheckEmailPage() {
  const t = await getTranslations("auth");

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-secondary text-primary">
        <MailCheck className="size-8" aria-hidden />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight">{t("checkEmailTitle")}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("checkEmailText")}</p>
      <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
        {t("toLogin")}
      </Link>
    </div>
  );
}
