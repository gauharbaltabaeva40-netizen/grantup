import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";
import { ContinueButton } from "@/components/brand/continue-button";
import { EmptyState } from "@/components/brand/empty-state";
import { Logo } from "@/components/brand/logo";

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo size={44} />
      <EmptyState
        icon={Compass}
        title={t("errors.notFoundTitle")}
        description={t("errors.notFoundText")}
        action={<ContinueButton href="/">{t("common.toHome")}</ContinueButton>}
        className="w-full"
      />
    </main>
  );
}
