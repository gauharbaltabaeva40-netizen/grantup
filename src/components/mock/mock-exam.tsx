"use client";

/**
 * Сынақ ҰБТ экраны.
 * - Таймер сервер уақытымен түзетіледі; 0-ге жеткенде сынақ автоматты аяқталады.
 * - Сұрақтар бір-бірлеп серверден жүктеледі (дұрыс жауапсыз), келесісі алдын ала жүктеледі.
 * - Әр өзгеріс серверге жіберіледі. Байланыс үзілсе — кезек localStorage-те сақталып, қалпына келгенде жіберіледі.
 * - Әр сұраққа кеткен уақыт есептеледі (пәндер бойынша уақыт талдауы үшін).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, CloudOff, Flag, Grid3x3, Loader2, Check, Timer } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { FormMessage } from "@/components/forms/fields";
import { QuestionCard } from "@/components/quiz/question-card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { finishMock, getMockQuestion, saveMockAnswer } from "@/lib/mock/actions";
import type { MockAnswerState, MockErrorKey, MockState } from "@/lib/mock/types";
import type { QuizQuestion } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";
import { ExamProctor } from "./proctor";

type SaveStatus = "saved" | "saving" | "offline";
const RETRY_MS = 5000;

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function MockExam({ state }: { state: MockState }) {
  const t = useTranslations("mockExam.exam");
  const router = useRouter();
  const { attemptId, questionIds, sections } = state;
  const queueKey = `gu_mock_queue_${attemptId}`;

  const [index, setIndex] = useState(() => {
    const firstEmpty = questionIds.findIndex((id) => !state.answers[id]?.selected.length);
    return firstEmpty === -1 ? 0 : firstEmpty;
  });
  const [answers, setAnswers] = useState<Record<string, MockAnswerState>>(state.answers);
  const [questions, setQuestions] = useState<Record<number, QuizQuestion>>({});
  const [loadError, setLoadError] = useState<MockErrorKey | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [remaining, setRemaining] = useState(() => new Date(state.deadlineAt).getTime() - new Date(state.serverNow).getTime());
  const [navOpen, setNavOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Клиент сағатының сервермен айырмасы
  const offsetRef = useRef(new Date(state.serverNow).getTime() - Date.now());
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const queueRef = useRef<Map<string, MockAnswerState>>(new Map());
  const flushingRef = useRef(false);
  const questionStartRef = useRef(Date.now());
  const finishingRef = useRef(false);
  const finishRef = useRef<(auto?: boolean) => Promise<void>>(async () => {});

  const currentId = questionIds[index];
  const question = questions[index];
  const currentSection = sections.find((s) => index >= s.start && index < s.start + s.count);
  const answeredCount = questionIds.filter((id) => answers[id]?.selected.length).length;

  // ------------------------------------------------------------ сақтау кезегі
  const persistQueue = useCallback(() => {
    try {
      localStorage.setItem(queueKey, JSON.stringify(Object.fromEntries(queueRef.current)));
    } catch {}
  }, [queueKey]);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.size > 0) {
        const [questionId, value] = queueRef.current.entries().next().value!;
        setSaveStatus("saving");
        let result;
        try {
          result = await saveMockAnswer({ attemptId, questionId, ...value });
        } catch {
          // Желі қатесі — кейін қайталаймыз
          setSaveStatus("offline");
          setTimeout(() => void flush(), RETRY_MS);
          return;
        }
        if (!result.ok && result.error === "time_over") {
          queueRef.current.clear();
          persistQueue();
          void finishRef.current(true);
          return;
        }
        if (!result.ok && (result.error === "rate_limited" || result.error === "unknown")) {
          setSaveStatus("offline");
          setTimeout(() => void flush(), RETRY_MS);
          return;
        }
        // Сақталды (немесе жарамсыз — қайталаудың мәні жоқ). Кезекте жаңарақ мән болса, қалдырамыз.
        if (queueRef.current.get(questionId) === value) queueRef.current.delete(questionId);
        persistQueue();
      }
      setSaveStatus("saved");
    } finally {
      flushingRef.current = false;
    }
  }, [attemptId, persistQueue]);

  const enqueue = useCallback(
    (questionId: string, value: MockAnswerState) => {
      queueRef.current.set(questionId, value);
      persistQueue();
      void flush();
    },
    [flush, persistQueue],
  );

  // Бұрынғы сессиядан жіберілмей қалған жауаптар
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(queueKey) ?? "{}") as Record<string, MockAnswerState>;
      const entries = Object.entries(saved).filter(([id]) => questionIds.includes(id));
      if (entries.length) {
        setAnswers((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
        for (const [id, value] of entries) queueRef.current.set(id, value);
        void flush();
      }
    } catch {}
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush, queueKey, questionIds]);

  // Ағымдағы сұраққа кеткен уақытты жазу
  const commitTime = useCallback(
    (questionId: string, send: boolean) => {
      const elapsed = Date.now() - questionStartRef.current;
      questionStartRef.current = Date.now();
      if (elapsed < 1000) return;
      const prev = answersRef.current[questionId] ?? { selected: [], flagged: false, timeSpentMs: 0 };
      const next = { ...prev, timeSpentMs: Math.min(prev.timeSpentMs + elapsed, 4 * 3600_000) };
      setAnswers((a) => ({ ...a, [questionId]: next }));
      answersRef.current = { ...answersRef.current, [questionId]: next };
      if (send) enqueue(questionId, next);
    },
    [enqueue],
  );

  // ------------------------------------------------------------ аяқтау
  const finish = useCallback(
    async (auto = false) => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      setFinishing(true);
      setConfirmOpen(false);
      if (!auto) commitTime(currentId, true);
      // Кезектегі жауаптарды жіберуге тырысамыз
      for (let i = 0; i < 3 && queueRef.current.size > 0; i++) {
        await flush();
        if (queueRef.current.size > 0) await new Promise((r) => setTimeout(r, 1500));
      }
      const result = await finishMock(attemptId);
      if (result.ok) {
        try {
          localStorage.removeItem(queueKey);
        } catch {}
        router.replace(`/mock-exam/${attemptId}/result`);
      } else {
        finishingRef.current = false;
        setFinishing(false);
        setLoadError(result.error);
      }
    },
    [attemptId, commitTime, currentId, flush, queueKey, router],
  );
  finishRef.current = finish;

  // ------------------------------------------------------------ таймер
  useEffect(() => {
    const deadline = new Date(state.deadlineAt).getTime();
    const tick = () => {
      const left = deadline - (Date.now() + offsetRef.current);
      setRemaining(left);
      if (left <= 0) void finish(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [finish, state.deadlineAt]);

  // ------------------------------------------------------------ сұрақ жүктеу
  const load = useCallback(
    async (i: number, silent = false) => {
      if (i < 0 || i >= questionIds.length) return;
      const result = await getMockQuestion(attemptId, i);
      if (result.ok) setQuestions((q) => ({ ...q, [i]: result.data }));
      else if (result.error === "time_over") void finish(true);
      else if (!silent) setLoadError(result.error);
    },
    [attemptId, finish, questionIds.length],
  );

  useEffect(() => {
    setLoadError(null);
    if (!questions[index]) void load(index);
    // Келесі сұрақты алдын ала жүктеу
    if (!questions[index + 1]) void load(index + 1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- тек индекс өзгергенде
  }, [index]);

  const goTo = (i: number) => {
    if (i === index || i < 0 || i >= questionIds.length) return;
    commitTime(currentId, true);
    setIndex(i);
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };

  // Пернетақта: ← → сұрақтар арасында
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || confirmOpen || navOpen) return;
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ------------------------------------------------------------ жауап беру
  const current = answers[currentId] ?? { selected: [], flagged: false, timeSpentMs: 0 };

  const toggleOption = (optionId: string) => {
    if (!question || finishing) return;
    const selected =
      question.type === "multiple"
        ? current.selected.includes(optionId)
          ? current.selected.filter((id) => id !== optionId)
          : [...current.selected, optionId]
        : current.selected.includes(optionId)
          ? []
          : [optionId];
    const elapsed = Date.now() - questionStartRef.current;
    questionStartRef.current = Date.now();
    const next = { ...current, selected, timeSpentMs: Math.min(current.timeSpentMs + elapsed, 4 * 3600_000) };
    setAnswers((a) => ({ ...a, [currentId]: next }));
    enqueue(currentId, next);
  };

  const toggleFlag = () => {
    const next = { ...current, flagged: !current.flagged };
    setAnswers((a) => ({ ...a, [currentId]: next }));
    enqueue(currentId, next);
  };

  const lowTime = remaining < 10 * 60_000;
  const unanswered = questionIds.length - answeredCount;

  const navigator = useMemo(
    () => (
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.subject}>
            <p className="mb-2 text-sm font-bold">{section.title}</p>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-6">
              {Array.from({ length: section.count }, (_, k) => {
                const i = section.start + k;
                const a = answers[questionIds[i]];
                const answered = Boolean(a?.selected.length);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`${t("questionN", { n: i + 1 })}${answered ? ` — ${t("answered")}` : ""}${a?.flagged ? ` — ${t("flagged")}` : ""}`}
                    aria-current={i === index ? "step" : undefined}
                    className={cn(
                      "relative grid aspect-square place-items-center rounded-lg text-xs font-bold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      answered ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:bg-muted",
                      i === index && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                    )}
                  >
                    {i + 1}
                    {a?.flagged && <span className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-card bg-streak" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-primary" />{t("answered")}</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-streak" />{t("flagged")}</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded border bg-card" />{t("empty")}</span>
        </div>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goTo жаңа сілтеме, бірақ күйге тәуелді
    [answers, index, sections, questionIds, t],
  );

  return (
    <div className="min-h-dvh pb-24 lg:pb-8">
      {/* Жоғарғы жолақ: таймер және аяқтау */}
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo size={30} showText={false} href="#" className="pointer-events-none hidden sm:inline-flex" />
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-lg font-bold tabular-nums",
              lowTime ? "bg-danger/10 text-danger" : "bg-secondary text-primary",
            )}
            role="timer"
            aria-label={t("timeLeft")}
          >
            <Timer className="size-5" aria-hidden />
            {formatClock(remaining)}
          </div>
          <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">
            {t("answeredCount", { answered: answeredCount, total: questionIds.length })}
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {saveStatus === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {saveStatus === "saved" && <Check className="size-3.5 text-success" aria-hidden />}
            {saveStatus === "offline" && <CloudOff className="size-3.5 text-danger" aria-hidden />}
            {saveStatus !== "offline" && <span className="hidden sm:inline">{t(saveStatus)}</span>}
          </span>
          <Button variant="brand" size="lg" className="h-10 rounded-full px-4" onClick={() => setConfirmOpen(true)} disabled={finishing}>
            {t("finish")}
          </Button>
        </div>

        {/* Пәндер қойындылары */}
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3" aria-label={t("navigator")}>
          {sections.map((s) => {
            const done = questionIds.slice(s.start, s.start + s.count).filter((id) => answers[id]?.selected.length).length;
            const active = currentSection?.subject === s.subject;
            return (
              <button
                key={s.subject}
                type="button"
                onClick={() => goTo(s.start)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-full border-2 px-3.5 text-sm font-semibold transition-colors",
                  active ? "border-primary bg-secondary text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {s.title}
                <span className="text-xs tabular-nums opacity-80">{done}/{s.count}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {saveStatus === "offline" && (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <FormMessage>{t("offline")}</FormMessage>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-5 lg:grid-cols-[1fr_280px]">
        <main className="min-w-0">
          <div className="rounded-2xl bg-card p-5 shadow-soft sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-muted-foreground">
                {t("questionN", { n: index + 1 })} · {currentSection?.title}
              </p>
              <Button variant={current.flagged ? "secondary" : "ghost"} size="lg" onClick={toggleFlag} aria-pressed={current.flagged}>
                <Flag className={cn("size-4", current.flagged && "fill-streak text-streak")} aria-hidden />
                {current.flagged ? t("unflag") : t("flag")}
              </Button>
            </div>

            {loadError && <FormMessage>{t(`errors.${loadError}`)}</FormMessage>}
            {question ? (
              <QuestionCard question={question} selected={current.selected} onToggle={toggleOption} />
            ) : (
              !loadError && (
                <div className="grid min-h-60 place-items-center" aria-busy>
                  <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                </div>
              )
            )}
          </div>

          <div className="mt-4 hidden gap-3 lg:flex">
            <Button variant="outline" size="xl" onClick={() => goTo(index - 1)} disabled={index === 0}>
              <ArrowLeft aria-hidden />
              {t("prev")}
            </Button>
            <Button variant="brand" size="xl" className="ml-auto" onClick={() => goTo(index + 1)} disabled={index === questionIds.length - 1}>
              {t("next")}
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </main>

        {/* Компьютерде — оң жақта навигатор */}
        <aside className="hidden lg:block">
          <div className="sticky top-36 rounded-2xl bg-card p-4 shadow-soft">{navigator}</div>
        </aside>
      </div>

      {/* Телефонда — төменгі басқару панелі */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden">
        <Button variant="outline" size="xl" className="px-4" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label={t("prev")}>
          <ArrowLeft aria-hidden />
        </Button>
        <Button variant="secondary" size="xl" className="flex-1" onClick={() => setNavOpen(true)}>
          <Grid3x3 aria-hidden />
          {t("answeredCount", { answered: answeredCount, total: questionIds.length })}
        </Button>
        <Button variant="brand" size="xl" className="px-4" onClick={() => goTo(index + 1)} disabled={index === questionIds.length - 1} aria-label={t("next")}>
          <ArrowRight aria-hidden />
        </Button>
      </div>

      <ExamProctor attemptId={attemptId} />

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="bottom" className="max-h-[80dvh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold">{t("navigator")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{navigator}</div>
        </SheetContent>
      </Sheet>

      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl" showCloseButton={false}>
          <SheetHeader className="pt-6 text-center">
            <SheetTitle className="text-xl font-extrabold">{t("finishConfirmTitle")}</SheetTitle>
            <SheetDescription className="text-[15px]">{t("finishConfirmText", { count: unanswered })}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row">
            <Button variant="outline" size="2xl" className="flex-1" onClick={() => setConfirmOpen(false)}>
              {t("keepGoing")}
            </Button>
            <Button variant="brand" size="2xl" className="flex-1" onClick={() => void finish()} disabled={finishing}>
              {finishing && <Loader2 className="animate-spin" aria-hidden />}
              {t("confirmFinish")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {finishing && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-background/90 backdrop-blur" role="alert">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 size-10 animate-spin text-primary" aria-hidden />
            <p className="font-bold">{remaining <= 0 ? t("timeOver") : t("saving")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
