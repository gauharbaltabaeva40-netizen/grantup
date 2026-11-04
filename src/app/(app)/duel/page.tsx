import { getLocale, getTranslations } from "next-intl/server";
import { DuelHub } from "@/components/duel/duel-hub";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/motion/fade-in";
import { getDuelHub } from "@/lib/duel/data";

export async function generateMetadata() {
  const t = await getTranslations("duel");
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function DuelPage() {
  const locale = await getLocale();
  const [t, hub] = await Promise.all([getTranslations("duel"), getDuelHub(locale)]);

  return (
    <FadeIn className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />
      <DuelHub
        subjects={hub?.subjects ?? []}
        mixedAvailable={hub?.mixedAvailable ?? false}
        items={hub?.items ?? []}
        stats={{ wins: hub?.wins ?? 0, losses: hub?.losses ?? 0, draws: hub?.draws ?? 0 }}
      />
    </FadeIn>
  );
}
