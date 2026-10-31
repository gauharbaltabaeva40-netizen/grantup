import type { LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ContinueButton } from "@/components/brand/continue-button";
import { EmptyState } from "@/components/brand/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { PageHeader } from "./page-header";

type Section = "lessons" | "mockExam" | "league" | "profile";

/** 1-кезеңге арналған уақытша бет: тақырып + бос күй + «келесі қадам» батырмасы. */
export async function PlaceholderPage({ section, icon }: { section: Section; icon: LucideIcon }) {
  const t = await getTranslations(section);
  const tc = await getTranslations("common");

  return (
    <FadeIn>
      <PageHeader title={t("title")} description={t("description")} />
      <EmptyState
        icon={icon}
        title={t("emptyTitle")}
        description={t("emptyText")}
        action={<ContinueButton href="/">{tc("toHome")}</ContinueButton>}
      />
    </FadeIn>
  );
}

export async function placeholderMetadata(section: Section) {
  const t = await getTranslations(section);
  return { title: t("title") };
}
