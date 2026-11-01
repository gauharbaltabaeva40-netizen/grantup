"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Markdown } from "@/components/content/markdown";
import { FormMessage } from "@/components/forms/fields";
import { AiExplain } from "@/components/quiz/ai-explain";
import { QuestionCard } from "@/components/quiz/question-card";
import { Button } from "@/components/ui/button";
import { getMockReviewQuestion } from "@/lib/mock/actions";
import type { MockReviewState } from "@/lib/mock/data";
import type { MockErrorKey } from "@/lib/mock/types";
import type { QuizQuestion } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";

const statusStyle = {
  correct: "bg-success text-white",
  wrong: "bg-danger text-white",
  empty: "border bg-card text-muted-foreground",
} as const;

/** Аяқталған сынақты шолу: әр сұрақ — оқушы жауабы, дұрыс жауап және түсіндірме. */
export function MockReview({ state }: { state: MockReviewState }) {
  const t = useTranslations("mockExam");
  const tq = useTranslations("quiz");
  const [index, setIndex] = useState(() => Math.max(0, state.questionIds.findIndex((id) => state.statuses[id] !== "correct")));
  const [cache, setCache] = useState<Record<number, QuizQuestion>>({});
  const [error, setError] = useState<MockErrorKey | null>(null);

  useEffect(() => {
    if (cache[index]) return;
    let cancelled = false;
    setError(null);
    getMockReviewQuestion(state.attemptId, index).then((result) => {
      if (cancelled) return;
      if (result.ok) setCache((c) => ({ ...c, [index]: result.data }));
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [cache, index, state.attemptId]);

  const question = cache[index];
  const status = state.statuses[state.questionIds[index]];
  const section = state.sections.find((s) => index >= s.start && index < s.start + s.count);
  const go = (i: number) => {
    if (i < 0 || i >= state.questionIds.length) return;
    setIndex(i);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="min-w-0 space-y-4">
        <div className="rounded-2xl bg-card p-5 shadow-soft sm:p-6">
          <p className="mb-4 text-sm font-bold text-muted-foreground">
            {t("exam.questionN", { n: index + 1 })} · {section?.title}
            {status === "empty" && <span className="ml-2 text-streak">· {t("review.notAnswered")}</span>}
          </p>
          {error && <FormMessage>{t(`exam.errors.${error}`)}</FormMessage>}
          {question ? (
            <>
              <QuestionCard question={question} selected={[]} onToggle={() => {}} />
              {question.feedback?.explanation && (
                <div className="mt-5 rounded-2xl bg-secondary p-4">
                  <p className="mb-1 text-sm font-bold">{tq("explanation")}</p>
                  <Markdown className="text-[15px]">{question.feedback.explanation}</Markdown>
                </div>
              )}
              {status !== "correct" && (
                <div className="mt-4">
                  <AiExplain key={question.questionId} attemptId={state.attemptId} questionId={question.questionId} />
                </div>
              )}
            </>
          ) : (
            !error && (
              <div className="grid min-h-60 place-items-center" aria-busy>
                <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
              </div>
            )
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="xl" onClick={() => go(index - 1)} disabled={index === 0}>
            <ArrowLeft aria-hidden />
            {t("exam.prev")}
          </Button>
          <Button variant="brand" size="xl" className="ml-auto" onClick={() => go(index + 1)} disabled={index === state.questionIds.length - 1}>
            {t("exam.next")}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </div>

      <aside className="space-y-4 rounded-2xl bg-card p-4 shadow-soft lg:sticky lg:top-20 lg:self-start">
        {state.sections.map((s) => (
          <div key={s.subject}>
            <p className="mb-2 text-sm font-bold">{s.title}</p>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-6">
              {Array.from({ length: s.count }, (_, k) => {
                const i = s.start + k;
                const st = state.statuses[state.questionIds[i]];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`${t("exam.questionN", { n: i + 1 })}`}
                    aria-current={i === index ? "step" : undefined}
                    className={cn(
                      "grid aspect-square place-items-center rounded-lg text-xs font-bold tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      statusStyle[st],
                      i === index && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-success" />{t("review.legendCorrect")}</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-danger" />{t("review.legendWrong")}</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded border bg-card" />{t("review.legendEmpty")}</span>
        </div>
      </aside>
    </div>
  );
}
