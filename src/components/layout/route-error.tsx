"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";

/** Маршрут қатесі: сабырлы хабар + қайталау. Әр бөлімнің error.tsx-і осыны қолданады. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={TriangleAlert}
      title={t("errors.errorTitle")}
      description={t("errors.errorText")}
      action={
        <Button variant="brand" size="2xl" className="w-full sm:w-auto" onClick={reset}>
          <RotateCcw aria-hidden />
          {t("common.retry")}
        </Button>
      }
    />
  );
}
