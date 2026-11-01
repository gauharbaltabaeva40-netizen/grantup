"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { regeneratePlan } from "@/lib/plan/actions";

export function RegeneratePlanButton() {
  const t = useTranslations("plan");
  const tq = useTranslations("quiz");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="xl"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await regeneratePlan();
          if (result.ok) {
            toast.success(t("regenerated"));
            router.refresh();
          } else toast.error(result.error === "limit" ? t("limit") : tq("errors.unknown"));
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
      {t("regenerate")}
    </Button>
  );
}
