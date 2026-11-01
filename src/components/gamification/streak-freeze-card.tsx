"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buyStreakFreeze } from "@/lib/gamification/actions";

export function StreakFreezeCard({ freezes, xp, cost }: { freezes: number; xp: number; cost: number }) {
  const t = useTranslations("streakFreeze");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-5 shadow-soft">
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-sky/12 text-brand-sky">
        <Snowflake className="size-6" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("text", { cost })}</p>
        <p className="mt-1 text-sm font-semibold">{t("have", { count: freezes })}</p>
      </div>
      <Button
        variant="outline"
        size="xl"
        disabled={pending || freezes >= 2 || xp < cost}
        onClick={() =>
          startTransition(async () => {
            const result = await buyStreakFreeze();
            if (result.ok) {
              toast.success(t("bought"));
              router.refresh();
            } else toast.error(t(result.error ?? "unknown"));
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Snowflake aria-hidden />}
        {t("buy", { cost })}
      </Button>
    </div>
  );
}
