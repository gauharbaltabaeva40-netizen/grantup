"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Play } from "lucide-react";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { startMock } from "@/lib/mock/actions";
import type { MockErrorKey } from "@/lib/mock/types";

export function StartMockButton({ mockExamId, label }: { mockExamId: string; label: string }) {
  const t = useTranslations("mockExam.exam");
  const router = useRouter();
  const [error, setError] = useState<MockErrorKey | null>(null);
  const [pending, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      setError(null);
      const result = await startMock(mockExamId);
      if (!result.ok) return setError(result.error);
      router.push(`/exam/${result.data.attemptId}`);
    });

  return (
    <div className="space-y-2">
      <Button variant="brand" size="xl" className="w-full sm:w-auto" onClick={start} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Play className="fill-current" aria-hidden />}
        {label}
      </Button>
      {error && <FormMessage>{t(`errors.${error}`)}</FormMessage>}
    </div>
  );
}
