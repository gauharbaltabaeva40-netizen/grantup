"use client";

import { useRef } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadQuestionImage } from "@/lib/admin/question-actions";
import { useAdminAction } from "./use-admin-action";

/** Сұрақ/мәтін суреті: жабық бакетке жүктеледі, превью — қысқа мерзімді сілтемемен. */
export function ImageUpload({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (value: { path: string | null; url: string | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending, run } = useAdminAction();

  function upload(file: File | undefined) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    run(() => uploadQuestionImage(formData), "Сурет жүктелді", (data) => data && onChange(data));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-muted-foreground">Сурет (PNG/JPEG/WebP, ≤ 2 МБ)</span>
      {url ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- қысқа мерзімді signed URL */}
          <img src={url} alt="" className="max-h-56 rounded-xl border" />
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            className="absolute top-2 right-2"
            aria-label="Суретті алып тастау"
            onClick={() => onChange({ path: null, url: null })}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" className="h-10" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
          Сурет жүктеу
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}
