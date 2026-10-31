"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { XpBurst } from "@/components/motion/xp-burst";
import { Button } from "@/components/ui/button";
import { completeLesson } from "@/lib/lessons/actions";

/** Тесті жоқ сабақты аяқтау батырмасы. */
export function CompleteLessonButton({ lessonId }: { lessonId: string }) {
  const t = useTranslations("lessons.lesson");
  const tq = useTranslations("quiz");
  const router = useRouter();
  const [burst, setBurst] = useState<{ key: number; amount: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = () =>
    startTransition(async () => {
      const result = await completeLesson(lessonId);
      if (!result.ok) return void toast.error(tq("errors.unknown"));
      if (result.xp > 0) setBurst({ key: Date.now(), amount: result.xp });
      if (result.levelUp && result.level) toast.success(tq("levelUp", { level: result.level }));
      router.refresh();
    });

  return (
    <div className="relative">
      <XpBurst burstKey={burst?.key ?? null} amount={burst?.amount ?? 0} />
      <Button variant="brand" size="2xl" className="w-full sm:w-auto" onClick={complete} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
        {t("complete")}
      </Button>
    </div>
  );
}
