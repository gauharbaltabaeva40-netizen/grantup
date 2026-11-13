"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { PenCheck } from "@/components/brand/pen-marks";
import { Markdown } from "@/components/content/markdown";
import type { QuizQuestion } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** Бір сұрақ: (контекстік мәтін) + сұрақ + нұсқалар. Жауап тексерілгеннен кейін дұрыс/қате белгіленеді. */
export function QuestionCard({
  question,
  selected,
  onToggle,
}: {
  question: QuizQuestion;
  selected: string[];
  onToggle: (optionId: string) => void;
}) {
  const t = useTranslations("quiz");
  const feedback = question.feedback;
  const multiple = question.type === "multiple";

  return (
    <div className="space-y-4">
      {question.passage && (
        <details open className="rounded-2xl bg-muted/70 p-4">
          <summary className="cursor-pointer text-sm font-bold text-muted-foreground">{t("passage")}</summary>
          <Markdown className="mt-3">{question.passage}</Markdown>
        </details>
      )}

      <Markdown className="font-semibold">{question.stem}</Markdown>
      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL, оптимизация қажет емес
        <img src={question.imageUrl} alt="" className="max-h-72 rounded-xl border object-contain" draggable={false} />
      )}

      <p className="text-xs font-semibold text-muted-foreground">{multiple ? t("chooseMany") : t("chooseOne")}</p>

      <ul className="space-y-2.5" role={multiple ? "group" : "radiogroup"}>
        {question.options.map((option, i) => {
          const isSelected = (feedback?.selectedOptionIds ?? selected).includes(option.id);
          const isCorrect = feedback?.correctOptionIds.includes(option.id);
          const state = !feedback
            ? isSelected
              ? "selected"
              : "idle"
            : isCorrect
              ? "correct"
              : isSelected
                ? "wrong"
                : "idle";

          return (
            <li key={option.id}>
              <button
                type="button"
                role={multiple ? "checkbox" : "radio"}
                aria-checked={isSelected}
                disabled={Boolean(feedback)}
                onClick={() => onToggle(option.id)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-card px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                  state === "idle" && "border-border hover:border-primary/40 hover:bg-secondary/50",
                  state === "selected" && "border-primary bg-secondary",
                  state === "correct" && "border-success bg-success/10",
                  state === "wrong" && "border-danger bg-danger/10",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center text-sm font-bold",
                    multiple ? "rounded-lg" : "rounded-full",
                    // Жауап парағындағы дөңгелек сияқты: бос — жиегі ғана, белгіленген — сиямен боялған
                    state === "idle" && "border-[1.5px] border-input text-muted-foreground",
                    state === "selected" && "bg-primary text-primary-foreground",
                    state === "correct" && "bg-success text-white",
                    state === "wrong" && "bg-danger text-white",
                  )}
                >
                  {state === "correct" ? <Check className="size-4" strokeWidth={3} /> : state === "wrong" ? <X className="size-4" strokeWidth={3} /> : LETTERS[i]}
                </span>
                <Markdown inline className="min-w-0 flex-1 text-[15px]">
                  {option.content}
                </Markdown>
                {/* Мұғалімнің қызыл қаламмен «дұрыс» белгісі */}
                {state === "correct" && <PenCheck className="h-6 w-7 shrink-0" delay={0.1} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
