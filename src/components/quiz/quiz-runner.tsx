"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, CircleCheck, CircleX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/content/markdown";
import { FormMessage } from "@/components/forms/fields";
import { XpBurst } from "@/components/motion/xp-burst";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getQuizQuestion, submitQuizAnswer } from "@/lib/quiz/actions";
import type { ActionResult, QuizErrorKey, QuizQuestion, QuizResult } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";
import { AiExplain } from "./ai-explain";
import { QuestionCard } from "./question-card";

export type QuizRunnerProps = {
  /** Әрекетті бастау (сабақ тесті, жаттығу, «Қателерім») */
  start: () => Promise<ActionResult<{ attemptId: string; total: number }>>;
  finish: (attemptId: string) => Promise<ActionResult<QuizResult>>;
  /** Бастау экраны: түсіндірме мәтін және батырма жазуы */
  intro: React.ReactNode;
  startLabel: string;
  renderResult: (args: { result: QuizResult; xpTotal: number; restart: () => void; pending: boolean }) => React.ReactNode;
  /** false — дұрыс/қате көрсетілмейді, жауаптан кейін бірден келесі сұрақ (диагностика) */
  instantFeedback?: boolean;
  /** Сұрақ экранының үстіндегі қосымша жолақ (мысалы, таймер) */
  header?: React.ReactNode;
};

type View = { step: "intro" } | { step: "question"; question: QuizQuestion } | { step: "result"; result: QuizResult };

/** Тест ағыны: сұрақтар серверден бір-бірлеп келеді, әр жауап бірден тексеріледі (дұрыс жауап клиентте жоқ). */
export function QuizRunner({ start, finish, intro, startLabel, renderResult, instantFeedback = true, header }: QuizRunnerProps) {
  const t = useTranslations("quiz");
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

  const begin = () =>
    run(async () => {
      const result = await start();
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
      if (!instantFeedback) return advance(question);
      setView({ step: "question", question: { ...question, feedback: result.data } });
      if (result.data.xpAwarded > 0) {
        setXpTotal((x) => x + result.data.xpAwarded);
        setBurst({ key: Date.now(), amount: result.data.xpAwarded });
      }
    });

  const advance = async (question: QuizQuestion) => {
    if (question.index + 1 < question.total) return loadQuestion(question.attemptId, question.index + 1);
    return complete(question.attemptId);
  };

  const complete = async (attemptId: string) => {
    const result = await finish(attemptId);
      if (!result.ok) return setError(result.error);
    setXpTotal((x) => x + result.data.lessonXp);
    setView({ step: "result", result: result.data });
    if (result.data.levelUp && result.data.level) toast.success(t("levelUp", { level: result.data.level }));
    router.refresh();
  };

  const next = () =>
    run(async () => {
      if (view.step !== "question") return;
      await advance(view.question);
    });

  if (view.step === "intro") {
    return (
      <div className="space-y-4">
        {intro}
        {error && <FormMessage>{t(`errors.${error}`)}</FormMessage>}
        <Button variant="brand" size="2xl" className="w-full sm:w-auto" onClick={begin} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {startLabel}
        </Button>
      </div>
    );
  }

  if (view.step === "result") {
    return (
      <>
        {error && <FormMessage>{t(`errors.${error}`)}</FormMessage>}
        {renderResult({ result: view.result, xpTotal, restart: begin, pending })}
      </>
    );
  }

  const { question } = view;
  const feedback = question.feedback;
  const answered = Boolean(feedback);
  const progress = Math.round(((question.index + (answered ? 1 : 0)) / question.total) * 100);

  return (
    <div className="space-y-5">
      {header}
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
          <p
            className={cn(
              "flex items-center gap-2 font-extrabold",
              feedback.isCorrect ? "text-success" : feedback.points > 0 ? "text-streak" : "text-danger",
            )}
          >
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
          {!feedback.isCorrect && <AiExplain key={question.questionId} attemptId={question.attemptId} questionId={question.questionId} />}
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

/** Нәтиже экранының ортақ үстіңгі бөлігі: пайыз, дұрыс саны, XP. */
export function QuizResultSummary({
  result,
  xpTotal,
  tone,
  children,
}: {
  result: QuizResult;
  xpTotal: number;
  tone: "success" | "warning";
  children?: React.ReactNode;
}) {
  const t = useTranslations("quiz");
  return (
    <div className="space-y-5 text-center">
      <div
        className={cn(
          "mx-auto grid size-20 place-items-center rounded-full text-3xl",
          tone === "success" ? "bg-success/15" : "bg-streak/15",
        )}
        aria-hidden
      >
        {tone === "success" ? "🏆" : "💪"}
      </div>
      <div>
        <p className="text-4xl font-extrabold tabular-nums">{result.percent}%</p>
        <p className="mt-1 text-muted-foreground">{t("resultCorrect", { correct: result.correct, total: result.total })}</p>
        {xpTotal > 0 && <p className="mt-2 font-extrabold text-success">{t("xpEarned", { xp: xpTotal })}</p>}
      </div>
      {children}
    </div>
  );
}
