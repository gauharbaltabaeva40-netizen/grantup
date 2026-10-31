"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ListRestart, Lock, RotateCcw } from "lucide-react";
import { QuizResultSummary, QuizRunner } from "@/components/quiz/quiz-runner";
import { Button, buttonVariants } from "@/components/ui/button";
import { finishPractice, startPractice } from "@/lib/practice/actions";
import { PRACTICE_SIZES, type PracticeSize } from "@/lib/practice/constants";
import type { PracticeTopic } from "@/lib/practice/data";
import { cn } from "@/lib/utils";

/** Жаттығу: тақырып пен сұрақ санын таңдап, тест ағынын бастау. */
export function PracticeSetup({ subjectCode, topics }: { subjectCode: string; topics: PracticeTopic[] }) {
  const t = useTranslations("practice");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [size, setSize] = useState<PracticeSize>(10);

  const optionClass = (active: boolean, disabled = false) =>
    cn(
      "flex min-h-12 w-full items-center gap-3 rounded-xl border-2 px-4 py-2 text-left text-[15px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      active ? "border-primary bg-secondary text-primary" : "border-border bg-card hover:bg-muted",
      disabled && "cursor-not-allowed opacity-60 hover:bg-card",
    );

  return (
    <QuizRunner
      start={() => startPractice({ subjectCode, topicId, size })}
      finish={finishPractice}
      startLabel={t("start")}
      intro={
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("chooseTopic")}</legend>
            <div className="space-y-2">
              <button type="button" className={optionClass(topicId === null)} onClick={() => setTopicId(null)} aria-pressed={topicId === null}>
                {t("allTopics")}
              </button>
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  disabled={topic.locked || topic.questionCount === 0}
                  aria-pressed={topicId === topic.id}
                  className={optionClass(topicId === topic.id, topic.locked || topic.questionCount === 0)}
                  onClick={() => setTopicId(topic.id)}
                >
                  <span className="min-w-0 flex-1">{topic.title}</span>
                  {topic.locked ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="size-3.5" aria-hidden />
                      {t("locked")}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                      {t("questionsAvailable", { count: topic.questionCount })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("chooseSize")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {PRACTICE_SIZES.map((n) => (
                <button key={n} type="button" className={cn(optionClass(size === n), "justify-center")} onClick={() => setSize(n)} aria-pressed={size === n}>
                  {n}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-muted-foreground">{t("intro")}</p>
        </div>
      }
      renderResult={({ result, xpTotal, restart, pending }) => (
        <QuizResultSummary result={result} xpTotal={xpTotal} tone={result.percent >= 70 ? "success" : "warning"}>
          <p className="rounded-2xl bg-muted px-4 py-3 text-[15px] font-medium">{t("resultText")}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="brand" size="2xl" onClick={restart} disabled={pending}>
              <ListRestart aria-hidden />
              {t("again")}
            </Button>
            {result.correct < result.total && (
              <Link href="/practice/mistakes" className={buttonVariants({ variant: "outline", size: "2xl" })}>
                <RotateCcw aria-hidden />
                {t("toMistakes")}
              </Link>
            )}
          </div>
        </QuizResultSummary>
      )}
    />
  );
}
