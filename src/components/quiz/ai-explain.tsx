"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { Markdown } from "@/components/content/markdown";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";

type ErrorKey = "limit" | "ai_unavailable" | "rate_limited" | "unauthenticated" | "not_allowed" | "unknown";

/** «Неге қате?» батырмасы: AI түсіндірмесі серверден стриммен келеді. */
export function AiExplain({ attemptId, questionId }: { attemptId: string; questionId: string }) {
  const t = useTranslations("ai");
  const [state, setState] = useState<"idle" | "loading" | "streaming" | "done">("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<{ key: ErrorKey; max?: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setError(null);
    setText("");
    setState("loading");
    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, questionId }),
        signal: abortRef.current.signal,
      });
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => ({}))) as { error?: ErrorKey; max?: number };
        setError({ key: body.error ?? "unknown", max: body.max });
        setState("idle");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setState("streaming");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (acc.includes("\u0000ERROR")) {
          setError({ key: "unknown" });
          setState("idle");
          return;
        }
        setText(acc);
      }
      setState("done");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError({ key: "unknown" });
      setState("idle");
    }
  };

  if (state === "idle") {
    return (
      <div className="space-y-2">
        <Button variant="outline" size="lg" onClick={run} className="border-brand-violet/40 text-brand-violet hover:bg-brand-violet/10">
          <Sparkles aria-hidden />
          {t("why")}
        </Button>
        {error && <FormMessage>{t(`errors.${error.key}`, { max: error.max ?? 0 })}</FormMessage>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-violet/25 bg-brand-violet/5 p-4" aria-live="polite">
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-brand-violet">
        <Sparkles className="size-4" aria-hidden />
        {t("title")}
      </p>
      {state === "loading" || (state === "streaming" && !text) ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("thinking")}
        </p>
      ) : (
        <Markdown className="text-[15px]">{text}</Markdown>
      )}
    </div>
  );
}
