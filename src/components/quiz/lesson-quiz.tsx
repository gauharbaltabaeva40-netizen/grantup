"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, CircleCheck, CircleX, Loader2, RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/content/markdown";
import { FormMessage } from "@/components/forms/fields";
import { XpBurst } from "@/components/motion/xp-burst";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { finishLessonQuiz, getQuizQuestion, startLessonQuiz, submitQuizAnswer } from "@/lib/quiz/actions";
import type { QuizErrorKey, QuizQuestion, QuizResult } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";
import { QuestionCard } from "./question-card";

type Props = {
  lessonId: string;
  questionCount: number;
  passPercent: number;
  bestPercent: number | null;
  nextHref: string | null;
};

type View =
  | { step: "intro" }
  | { step: "question"; question: QuizQuestion }
  | { step: "result"; result: QuizResult };

/** Сабақ соңындағы тест: сұрақтар бір-бірлеп серверден келеді, әр жауап бірден тексеріледі. */
export function LessonQuiz({ lessonId, questionCount, passPercent, bestPercent, nextHref }: Props) {
  const t = useTranslations("quiz");
  const tl = useTranslations("lessons.lesson");
  const router = useRouter();
  const [view, setView] = useState<View>({ step: "intro" });
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<QuizErrorKey | null>(null);
  const [xpTotal, setXpTotal] = useState(0);
  const [burst, setBurst] = useState<{ key: number; amount: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      await fn();
    });

  const loadQuestion = async (attemptId: string, index: number) => {
    const result = await getQuizQuestion(attemptId, index);
    if (!result.ok) return setError(result.error);
    setSelected([]);
    setView({ step: "question", question: result.data });
  };

  const start = () =>
    run(async () => {
      const result = await startLessonQuiz(lessonId);
      if (!result.ok) return setError(result.error);
      setXpTotal(0);
      await loadQuestion(result.data.attemptId, 0);
    });

  const toggle = (optionId: string) => {
    if (view.step !== "question" || view.question.feedback) return;
    setSelected((prev) =>
      view.question.type === "multiple"
        ? prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId]
        : [optionId],
    );
  };

  const check = () =>
    run(async () => {
      if (view.step !== "question") return;
      const { question } = view;
      const result = await submitQuizAnswer(question.attemptId, question.questionId, selected);
      if (!result.ok) return setError(result.error);
      setView({ step: "question", question: { ...question, feedback: result.data } });
      if (result.data.xpAwarded > 0) {
        setXpTotal((x) => x + result.data.xpAwarded);
        setBurst({ key: Date.now(), amount: result.data.xpAwarded });
      }
    });

  const next = () =>
    run(async () => {
      if (view.step !== "question") return;
      const { question } = view;
      if (question.index + 1 < question.total) return loadQuestion(question.attemptId, question.index + 1);

      const result = await finishLessonQuiz(question.attemptId);
      if (!result.ok) return setError(result.error);
      setXpTotal((x) => x + result.data.lessonXp);
      setView({ step: "result", result: result.data });
      if (result.data.levelUp && result.data.level) toast.success(t("levelUp", { level: result.data.level }));
      router.refresh();
    });

  // ---------------------------------------------------------------- intro
  if (view.step === "intro") {
    return (
      <div className="space-y-4">
        <p className="text-[15px] text-muted-foreground">{tl("quizIntro", { count: questionCount, percent: passPercent })}</p>
        {bestPercent !== null && <p className="text-sm font-semibold">{tl("bestScore", { percent: bestPercent })}</p>}
        {error && <FormMessage>{t(`errors.${error}`)}</FormMessage>}
        <Button variant="brand" size="2xl" className="w-full sm:w-auto" onClick={start} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {bestPercent === null ? tl("quizStart") : t("retry")}
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------- result
  if (view.step === "result") {
    const { result } = view;
    return (
      <div className="space-y-5 text-center">
        <div
          className={cn(
            "mx-auto grid size-20 place-items-center rounded-full",
            result.passed ? "bg-success/15 text-success" : "bg-streak/15 text-streak",
          )}
        >
          <Trophy className="size-10" aria-hidden />
        </div>
        <div>
          <p className="text-4xl font-extrabold tabular-nums">{result.percent}%</p>
          <p className="mt-1 text-muted-foreground">{t("resultCorrect", { correct: result.correct, total: result.total })}</p>
          {xpTotal > 0 && <p className="mt-2 font-extrabold text-success">{t("xpEarned", { xp: xpTotal })}</p>}
        </div>
        <p className={cn("rounded-2xl px-4 py-3 text-[15px] font-medium", result.passed ? "bg-success/12" : "bg-streak/12")}>
          {result.passed ? t("passed") : t("failed", { percent: result.passPercent })}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {result.passed && nextHref ? (
            <Link href={nextHref} className={buttonVariants({ variant: "brand", size: "2xl" })}>
              {tl("next")}
              <ArrowRight aria-hidden />
            </Link>
          ) : null}
          {!result.passed && (
            <Button
              variant="brand"
              size="2xl"
              onClick={() => {
                setView({ step: "intro" });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {t("repeatLesson")}
            </Button>
          )}
          <Button variant="outline" size="2xl" onClick={start} disabled={pending}>
            <RotateCcw aria-hidden />
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- question
  const { question } = view;
  const feedback = question.feedback;
  const answered = Boolean(feedback);
  const progress = Math.round(((question.index + (answered ? 1 : 0)) / question.total) * 100);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Progress
          value={progress}
          aria-label={t("progress", { index: question.index + 1, total: question.total })}
          className="flex-1 [&_[data-slot=progress-indicator]]:bg-brand-gradient [&_[data-slot=progress-track]]:h-2.5"
        />
        <span className="text-sm font-bold text-muted-foreground tabular-nums">
          {t("progress", { index: question.index + 1, total: question.total })}
        </span>
      </div>

      <QuestionCard question={question} selected={selected} onToggle={toggle} />

      {error && <FormMessage>{t(`errors.${error}`)}</FormMessage>}

      {feedback && (
        <div
          className={cn(
            "space-y-2 rounded-2xl p-4",
            feedback.isCorrect ? "bg-success/12" : feedback.points > 0 ? "bg-streak/12" : "bg-danger/10",
          )}
          role="status"
        >
          <p className={cn("flex items-center gap-2 font-extrabold", feedback.isCorrect ? "text-success" : feedback.points > 0 ? "text-streak" : "text-danger")}>
            {feedback.isCorrect ? <CircleCheck className="size-5" aria-hidden /> : <CircleX className="size-5" aria-hidden />}
            {feedback.isCorrect ? t("correct") : feedback.points > 0 ? t("partial") : t("wrong")}
            {feedback.points > 0 && <span className="text-sm font-bold opacity-80">{t("points", { points: feedback.points })}</span>}
          </p>
          {feedback.explanation && (
            <div>
              <p className="mb-1 text-sm font-bold">{t("explanation")}</p>
              <Markdown className="text-[15px]">{feedback.explanation}</Markdown>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <XpBurst burstKey={burst?.key ?? null} amount={burst?.amount ?? 0} />
        {!answered ? (
          <Button variant="brand" size="2xl" className="w-full" onClick={check} disabled={pending || selected.length === 0}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("check")}
          </Button>
        ) : (
          <Button variant="brand" size="2xl" className="w-full" onClick={next} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {question.index + 1 < question.total ? t("next") : t("finish")}
            {!pending && <ArrowRight aria-hidden />}
          </Button>
        )}
      </div>
    </div>
  );
}
