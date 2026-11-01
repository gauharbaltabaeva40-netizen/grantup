"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Markdown } from "@/components/content/markdown";
import { Button } from "@/components/ui/button";
import { saveLesson } from "@/lib/admin/content-actions";
import { parseYoutubeId } from "@/lib/admin/youtube";
import { cn } from "@/lib/utils";
import { inputClass, textareaClass } from "./ui";
import { useAdminAction } from "./use-admin-action";

export type LessonEditorValues = {
  id: string;
  topic_id: string;
  title_kk: string;
  title_ru: string;
  is_free: boolean;
  is_published: boolean;
  duration_seconds: number | null;
  xp_reward: number;
  youtube: string;
  summary_kk: string;
  summary_ru: string;
};

/** Markdown өрісі + алдын ала қарау (KaTeX формулалары, кестелер) */
export function MarkdownField({
  label,
  value,
  onChange,
  rows = 10,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="flex rounded-full bg-muted p-0.5 text-xs font-semibold">
          {(["edit", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn("rounded-full px-3 py-1", tab === t && "bg-card shadow-soft")}
            >
              {t === "edit" ? "Мәтін" : "Көрініс"}
            </button>
          ))}
        </span>
      </div>
      {tab === "edit" ? (
        <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={textareaClass} />
      ) : (
        <div className="min-h-24 rounded-xl border bg-card px-4 py-3">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-sm text-muted-foreground">Бос</p>}
        </div>
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const MD_HINT = "Markdown: **қалың**, кесте, формула $x^2$ немесе $$\\frac{a}{b}$$.";

export function LessonEditor({ initial, topics }: { initial: LessonEditorValues; topics: { id: string; title: string }[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const set = <K extends keyof LessonEditorValues>(key: K, value: LessonEditorValues[K]) => setV((prev) => ({ ...prev, [key]: value }));
  const youtubeId = v.youtube ? parseYoutubeId(v.youtube) : null;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveLesson(v), "Сабақ сақталды", () => router.refresh());
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          Атауы (қаз)
          <input className={inputClass} value={v.title_kk} onChange={(e) => set("title_kk", e.target.value)} required />
        </label>
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          Атауы (орыс)
          <input className={inputClass} value={v.title_ru} onChange={(e) => set("title_ru", e.target.value)} required />
        </label>
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          Тақырып
          <select className={inputClass} value={v.topic_id} onChange={(e) => set("topic_id", e.target.value)}>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">
            Ұзақтығы (минут)
            <input
              type="number"
              min={0}
              max={360}
              className={inputClass}
              value={v.duration_seconds == null ? "" : Math.round(v.duration_seconds / 60)}
              onChange={(e) => set("duration_seconds", e.target.value === "" ? null : Number(e.target.value) * 60)}
            />
          </label>
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">
            XP
            <input type="number" min={0} max={1000} className={inputClass} value={v.xp_reward} onChange={(e) => set("xp_reward", Number(e.target.value))} />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-primary" checked={v.is_published} onChange={(e) => set("is_published", e.target.checked)} />
          Жарияланған
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-primary" checked={v.is_free} onChange={(e) => set("is_free", e.target.checked)} />
          Тегін сабақ (доступсыз оқушыларға да ашық)
        </label>
      </div>

      <div className="space-y-2">
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
          YouTube сілтемесі немесе ID (видео YouTube-та «Қолжетімділігі шектеулі / Unlisted» болуы керек)
          <input className={inputClass} value={v.youtube} onChange={(e) => set("youtube", e.target.value)} placeholder="https://youtu.be/..." />
        </label>
        {v.youtube && !youtubeId && <p className="text-sm font-semibold text-danger">Сілтеме танылмады.</p>}
        {youtubeId && (
          <p className="text-xs text-muted-foreground">
            Видео ID: <code className="rounded bg-muted px-1">{youtubeId}</code> — оқушыға қорғалған ойнатқышпен көрсетіледі.
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <MarkdownField label="Конспект (қаз)" value={v.summary_kk} onChange={(x) => set("summary_kk", x)} rows={16} hint={MD_HINT} />
        <MarkdownField label="Конспект (орыс)" value={v.summary_ru} onChange={(x) => set("summary_ru", x)} rows={16} />
      </div>

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t bg-card/95 px-5 py-3 backdrop-blur">
        <Button type="submit" variant="brand" size="xl" disabled={pending || Boolean(v.youtube && !youtubeId)}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Сақтау
        </Button>
      </div>
    </form>
  );
}
