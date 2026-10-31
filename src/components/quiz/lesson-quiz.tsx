"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { finishLessonQuiz, startLessonQuiz } from "@/lib/quiz/actions";
import { cn } from "@/lib/utils";
import { QuizResultSummary, QuizRunner } from "./quiz-runner";

type Props = {
  lessonId: string;
  questionCount: number;
  passPercent: number;
  bestPercent: number | null;
  nextHref: string | null;
};

/** Сабақ соңындағы тест. ≥ өту шегі — сабақ аяқталады; төмен — қайталау ұсынылады. */
export function LessonQuiz({ lessonId, questionCount, passPercent, bestPercent, nextHref }: Props) {
  const t = useTranslations("quiz");
  const tl = useTranslations("lessons.lesson");

  return (
    <QuizRunner
      start={() => startLessonQuiz(lessonId)}
      finish={finishLessonQuiz}
      startLabel={bestPercent === null ? tl("quizStart") : t("retry")}
      intro={
        <>
          <p className="text-[15px] text-muted-foreground">{tl("quizIntro", { count: questionCount, percent: passPercent })}</p>
          {bestPercent !== null && <p className="text-sm font-semibold">{tl("bestScore", { percent: bestPercent })}</p>}
        </>
      }
      renderResult={({ result, xpTotal, restart, pending }) => (
        <QuizResultSummary result={result} xpTotal={xpTotal} tone={result.passed ? "success" : "warning"}>
          <p className={cn("rounded-2xl px-4 py-3 text-[15px] font-medium", result.passed ? "bg-success/12" : "bg-streak/12")}>
            {result.passed ? t("passed") : t("failed", { percent: result.passPercent })}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {result.passed && nextHref && (
              <Link href={nextHref} className={buttonVariants({ variant: "brand", size: "2xl" })}>
                {tl("next")}
                <ArrowRight aria-hidden />
              </Link>
            )}
            {!result.passed && (
              <Button variant="brand" size="2xl" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                {t("repeatLesson")}
              </Button>
            )}
            <Button variant="outline" size="2xl" onClick={restart} disabled={pending}>
              <RotateCcw aria-hidden />
              {t("retry")}
            </Button>
          </div>
        </QuizResultSummary>
      )}
    />
  );
}
