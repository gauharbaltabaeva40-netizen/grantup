import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Swords } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { joinDuelByCode } from "@/lib/duel/actions";

export async function generateMetadata() {
  const t = await getTranslations("duel");
  return { title: t("joinTitle"), robots: { index: false } };
}

// Шақыру сілтемесі: кірген оқушы бірден дуэльге қосылады (кірмеген — middleware кіру бетіне жібереді)
export default async function JoinDuelPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await joinDuelByCode(code.toUpperCase());
  if (result.ok) redirect(`/duel/${result.data.duelId}`);

  const t = await getTranslations("duel");
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-card p-8 text-center shadow-soft">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
        <Swords className="size-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-extrabold">{t("joinTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t(`errors.${result.error}`)}</p>
      <Link href="/duel" className={buttonVariants({ variant: "brand", size: "xl", className: "mt-6" })}>
        {t("again")}
      </Link>
    </div>
  );
}
