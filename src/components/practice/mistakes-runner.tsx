"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListRestart } from "lucide-react";
import { QuizResultSummary, QuizRunner } from "@/components/quiz/quiz-runner";
import { Button } from "@/components/ui/button";
import { finishPractice, startMistakes } from "@/lib/practice/actions";
import { cn } from "@/lib/utils";

type SubjectFilter = { code: string; title: string; count: number };

/** «Қателерім»: пән бойынша сүзіп, қателерді қайта шешу. */
export function MistakesRunner({ subjects, total, bonusXp }: { subjects: SubjectFilter[]; total: number; bonusXp: number }) {
  const t = useTranslations("practice.mistakes");
  const [subject, setSubject] = useState<string | null>(null);

  const chip = (active: boolean) =>
    cn(
      "h-10 shrink-0 rounded-full border-2 px-4 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      active ? "border-primary bg-secondary text-primary" : "border-border bg-card hover:bg-muted",
    );

  return (
    <QuizRunner
      start={() => startMistakes(subject)}
      finish={finishPractice}
      startLabel={subject ? t("solveSubject") : t("solveAll")}
      intro={
        <div className="space-y-4">
          {subjects.length > 1 && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <button type="button" className={chip(subject === null)} onClick={() => setSubject(null)} aria-pressed={subject === null}>
                {t("filterAll")} · {total}
              </button>
              {subjects.map((s) => (
                <button key={s.code} type="button" className={chip(subject === s.code)} onClick={() => setSubject(s.code)} aria-pressed={subject === s.code}>
                  {s.title} · {s.count}
                </button>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
          <p className="text-sm font-bold text-success">{t("bonus", { xp: bonusXp })}</p>
        </div>
      }
      renderResult={({ result, xpTotal, restart, pending }) => (
        <QuizResultSummary result={result} xpTotal={xpTotal} tone={result.percent >= 70 ? "success" : "warning"}>
          <p className="rounded-2xl bg-muted px-4 py-3 text-[15px] font-medium">{t("resultText")}</p>
          {result.correct < result.total && (
            <Button variant="brand" size="2xl" onClick={restart} disabled={pending}>
              <ListRestart aria-hidden />
              {t("again")}
            </Button>
          )}
        </QuizResultSummary>
      )}
    />
  );
}
