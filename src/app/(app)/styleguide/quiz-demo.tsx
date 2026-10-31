"use client";

import { useState } from "react";
import { QuestionCard } from "@/components/quiz/question-card";
import type { QuizQuestion } from "@/lib/quiz/types";

const base: QuizQuestion = {
  attemptId: "demo",
  index: 0,
  total: 5,
  questionId: "q1",
  type: "multiple",
  stem: "Жұп функцияларды таңдаңыз.",
  passage: null,
  imageUrl: null,
  options: [
    { id: "a", content: "$y = x^2$" },
    { id: "b", content: "$y = \\cos x$" },
    { id: "c", content: "$y = x^3$" },
    { id: "d", content: "$y = \\sin x$" },
    { id: "e", content: "$y = x + 1$" },
  ],
  feedback: null,
};

/** Styleguide: сұрақ карточкасы — жауап беру алдында және тексерілгеннен кейін. */
export function QuizDemo() {
  const [selected, setSelected] = useState<string[]>(["a"]);
  const answered: QuizQuestion = {
    ...base,
    type: "single",
    stem: "Python бағдарламасы не шығарады?\n\n```python\nprint(7 // 2)\n```",
    options: [
      { id: "a", content: "3.5" },
      { id: "b", content: "3" },
      { id: "c", content: "4" },
    ],
    feedback: {
      isCorrect: false,
      points: 0,
      maxPoints: 1,
      selectedOptionIds: ["a"],
      correctOptionIds: ["b"],
      explanation: "`//` — бүтін бөлу: $7 // 2 = 3$.",
      xpAwarded: 0,
    },
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl bg-card p-5 shadow-soft">
        <QuestionCard
          question={base}
          selected={selected}
          onToggle={(id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))}
        />
      </div>
      <div className="rounded-2xl bg-card p-5 shadow-soft">
        <QuestionCard question={answered} selected={[]} onToggle={() => {}} />
      </div>
    </div>
  );
}
