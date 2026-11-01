"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, BookOpenCheck, Clock, Flame, Loader2, Sparkles, Target } from "lucide-react";
import { GradientCard } from "@/components/brand/gradient-card";
import { QuizResultSummary, QuizRunner } from "@/components/quiz/quiz-runner";
import { Button, buttonVariants } from "@/components/ui/button";
import { finishDiagnostic, saveGoal, skipOnboarding, startDiagnostic } from "@/lib/onboarding/actions";
import { cn } from "@/lib/utils";

type Specialty = { id: string; code: string; name: string; threshold: number };

type Props = {
  specialties: Specialty[];
  diagnosticCount: number;
  diagnosticMinutes: number;
  initialTarget: number | null;
};

const SLIDES = [
  { icon: BookOpenCheck, title: "s1t", text: "s1" },
  { icon: Flame, title: "s2t", text: "s2" },
  { icon: Sparkles, title: "s3t", text: "s3" },
] as const;

function Countdown({ minutes }: { minutes: number }) {
  const t = useTranslations("onboarding.diagnostic");
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-semibold tabular-nums", left < 120 ? "text-danger" : "text-muted-foreground")}>
      <Clock className="size-4" aria-hidden />
      {t("timer", { time })}
    </p>
  );
}

/** Онбординг: 3 слайд → мақсат → диагностика → AI жоспары. */
export function OnboardingFlow({ specialties, diagnosticCount, diagnosticMinutes, initialTarget }: Props) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"score" | "specialty">("score");
  const [score, setScore] = useState(initialTarget ?? 110);
  const [specialtyId, setSpecialtyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const totalSteps = SLIDES.length + 2;

  const skipAll = () =>
    startTransition(async () => {
      await skipOnboarding();
      router.replace("/");
      router.refresh();
    });

  const submitGoal = () =>
    startTransition(async () => {
      await saveGoal(mode === "specialty" && specialtyId ? { targetScore: null, specialtyId } : { targetScore: score, specialtyId: null });
      setStep(SLIDES.length + 1);
    });

  const progress = (
    <div className="mb-6 flex items-center gap-1.5" aria-label={t("step", { n: step + 1, total: totalSteps })}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
      ))}
    </div>
  );

  // ---------------------------------------------------------------- слайдтар
  if (step < SLIDES.length) {
    const slide = SLIDES[step];
    const Icon = slide.icon;
    return (
      <div>
        {progress}
        <GradientCard className="text-center">
          <div className="mx-auto mb-5 grid size-20 place-items-center rounded-3xl bg-white/15">
            <Icon className="size-10" aria-hidden />
          </div>
          <h1 className="text-2xl font-extrabold">{t(`slides.${slide.title}`)}</h1>
          <p className="mx-auto mt-2 max-w-sm text-white/85">{t(`slides.${slide.text}`)}</p>
        </GradientCard>
        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button variant="outline" size="2xl" onClick={() => setStep(step - 1)} aria-label={t("back")}>
              <ArrowLeft aria-hidden />
            </Button>
          )}
          <Button variant="brand" size="2xl" className="flex-1" onClick={() => setStep(step + 1)}>
            {t("next")}
            <ArrowRight aria-hidden />
          </Button>
        </div>
        <Button variant="ghost" size="xl" className="mt-3 w-full text-muted-foreground" onClick={skipAll} disabled={pending}>
          {t("skip")}
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------- мақсат
  if (step === SLIDES.length) {
    const chip = (active: boolean) =>
      cn(
        "h-11 flex-1 rounded-full border-2 text-sm font-bold transition-colors",
        active ? "border-primary bg-secondary text-primary" : "border-border bg-card text-muted-foreground",
      );
    return (
      <div className="space-y-5">
        {progress}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <Target className="size-6 text-primary" aria-hidden />
            {t("goal.title")}
          </h1>
          <p className="mt-1.5 text-muted-foreground">{t("goal.text")}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={chip(mode === "score")} onClick={() => setMode("score")} aria-pressed={mode === "score"}>
            {t("goal.byScore")}
          </button>
          <button type="button" className={chip(mode === "specialty")} onClick={() => setMode("specialty")} aria-pressed={mode === "specialty"}>
            {t("goal.bySpecialty")}
          </button>
        </div>

        {mode === "score" ? (
          <div className="rounded-2xl bg-card p-5 text-center shadow-soft">
            <p className="text-5xl font-extrabold tabular-nums text-primary">{score}</p>
            <p className="mb-4 text-sm text-muted-foreground">/ 140</p>
            <input
              type="range"
              min={50}
              max={140}
              step={1}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              aria-label={t("goal.byScore")}
              className="w-full accent-[#0047FF]"
            />
          </div>
        ) : specialties.length === 0 ? (
          <p className="rounded-2xl bg-muted p-4 text-sm">{t("goal.noSpecialties")}</p>
        ) : (
          <ul className="space-y-2" role="radiogroup">
            {specialties.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={specialtyId === s.id}
                  onClick={() => setSpecialtyId(s.id)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-card px-4 py-2 text-left",
                    specialtyId === s.id ? "border-primary bg-secondary" : "border-border",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.code}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">{t("goal.threshold", { score: s.threshold })}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="brand"
          size="2xl"
          className="w-full"
          onClick={submitGoal}
          disabled={pending || (mode === "specialty" && !specialtyId)}
        >
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("goal.save")}
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------- диагностика
  return (
    <div>
      {progress}
      <div className="rounded-2xl bg-card p-5 shadow-soft sm:p-6">
        <QuizRunner
          start={startDiagnostic}
          finish={finishDiagnostic}
          instantFeedback={false}
          header={<Countdown minutes={diagnosticMinutes} />}
          startLabel={t("diagnostic.start")}
          intro={
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold">{t("diagnostic.title")}</h1>
              <p className="text-muted-foreground">{t("diagnostic.text", { count: diagnosticCount, minutes: diagnosticMinutes })}</p>
            </div>
          }
          renderResult={({ result, xpTotal }) => (
            <QuizResultSummary result={result} xpTotal={xpTotal} tone="success">
              <div>
                <h2 className="text-xl font-extrabold">{t("diagnostic.resultTitle")}</h2>
                <p className="mt-1 text-muted-foreground">{t("diagnostic.planReady")}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/" className={buttonVariants({ variant: "brand", size: "2xl" })}>
                  {t("diagnostic.toHome")}
                  <ArrowRight aria-hidden />
                </Link>
                <Link href="/plan" className={buttonVariants({ variant: "outline", size: "2xl" })}>
                  {t("diagnostic.toPlan")}
                </Link>
              </div>
            </QuizResultSummary>
          )}
        />
      </div>
      <Button variant="ghost" size="xl" className="mt-3 w-full text-muted-foreground" onClick={skipAll} disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("diagnostic.later")}
      </Button>
    </div>
  );
}
