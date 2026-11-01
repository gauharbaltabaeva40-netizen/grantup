"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AdminResult } from "@/lib/admin/types";

/** Админ әрекетін іске қосу: күту күйі + сәтті/қате toast. Сәтті болса деректі қайтарады. */
export function useAdminAction() {
  const te = useTranslations("admin.errors");
  const [pending, startTransition] = useTransition();

  function run<T>(action: () => Promise<AdminResult<T>>, success?: string, onOk?: (data: T | undefined) => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (success) toast.success(success);
        onOk?.(result.data);
      } else {
        toast.error(result.detail ? `${te(result.error)} ${result.detail}` : te(result.error));
      }
    });
  }

  return { pending, run };
}
