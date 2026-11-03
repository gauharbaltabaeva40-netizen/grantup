"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { startMock } from "@/lib/mock/actions";
import type { MockErrorKey } from "@/lib/mock/types";
import { CameraCheck } from "./proctor";

/** Сынақ ҰБТ-ны бастау: алдымен прокторинг келісімі мен камераны тексеру, содан кейін сынақ жасалады (таймер сонда басталады). */
export function StartMockButton({ mockExamId, label }: { mockExamId: string; label: string }) {
  const t = useTranslations("mockExam");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<MockErrorKey | null>(null);
  const [pending, startTransition] = useTransition();

  const start = () =>
    startTransition(async () => {
      setError(null);
      const result = await startMock(mockExamId);
      if (!result.ok) {
        setOpen(false);
        return setError(result.error);
      }
      router.push(`/exam/${result.data.attemptId}`);
    });

  return (
    <div className="space-y-2">
      <Button variant="brand" size="xl" className="w-full sm:w-auto" onClick={() => setOpen(true)} disabled={pending}>
        <Play className="fill-current" aria-hidden />
        {label}
      </Button>
      {error && <FormMessage>{t(`exam.errors.${error}`)}</FormMessage>}

      <Sheet open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-lg overflow-y-auto rounded-t-3xl" showCloseButton={false}>
          <SheetHeader>
            <SheetTitle className="text-lg font-bold">{t("proctor.checkTitle")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {open && <CameraCheck pending={pending} onReady={start} onCancel={() => setOpen(false)} />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
