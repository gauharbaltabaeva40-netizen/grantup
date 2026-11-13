"use client";

/**
 * Сынақ ҰБТ экраны.
 * - Таймер сервер уақытымен түзетіледі; 0-ге жеткенде сынақ автоматты аяқталады.
 * - Сұрақтар бір-бірлеп серверден жүктеледі (дұрыс жауапсыз), келесісі алдын ала жүктеледі.
 * - Әр өзгеріс серверге жіберіледі. Байланыс үзілсе — кезек localStorage-те сақталып, қалпына келгенде жіберіледі.
 * - Әр сұраққа кеткен уақыт есептеледі (пәндер бойынша уақыт талдауы үшін).
 * - Интерфейс ресми сынақ ҰБТ-ға ұқсас: пән бойынша нөмірлер жолағы, «Келесі сұрақ / Келесі пән»,
 *   бөлімдер мәзірі, жауап картасы, калькулятор, аяқтау алдында жауаптар кестесі және қарапайым мысал.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Calculator as CalculatorIcon,
  Check,
  ChevronRight,
  CloudOff,
  Flag,
  Grid3x3,
  Info,
  Loader2,
  LogOut,
  Menu,
  Timer,
} from "lucide-react";
import { FormMessage } from "@/components/forms/fields";
import { QuestionCard } from "@/components/quiz/question-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { finishMock, getMockQuestion, saveMockAnswer } from "@/lib/mock/actions";
import type { MockAnswerState, MockErrorKey, MockState } from "@/lib/mock/types";
import type { QuizQuestion } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";
import { Calculator } from "./calculator";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Аяқтау: 1 — жауаптар кестесі, 2 — қарапайым мысал
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [captcha, setCaptcha] = useState({ a: 2, b: 2 });
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaWrong, setCaptchaWrong] = useState(false);
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
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  // Пернетақта: ← → сұрақтар арасында
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || confirmOpen || navOpen || menuOpen || calcOpen) return;
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
  const sectionIndex = Math.max(0, sections.findIndex((s) => s === currentSection));
  const nextSection = sections[sectionIndex + 1];
  const localNo = currentSection ? index - currentSection.start + 1 : index + 1;
  const doneIn = (s: (typeof sections)[number]) =>
    questionIds.slice(s.start, s.start + s.count).filter((id) => answers[id]?.selected.length).length;
  const instruction = question ? (question.passage ? "context" : question.type === "multiple" ? "multiple" : "single") : null;

  const openFinish = () => {
    setMenuOpen(false);
    setConfirmStep(1);
    setConfirmOpen(true);
  };

  const toCaptcha = () => {
    setCaptcha({ a: 1 + Math.floor(Math.random() * 9), b: 1 + Math.floor(Math.random() * 9) });
    setCaptchaInput("");
    setCaptchaWrong(false);
    setConfirmStep(2);
  };

  const submitCaptcha = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(captchaInput.trim()) === captcha.a + captcha.b) void finish();
    else setCaptchaWrong(true);
  };

  /** Жауап картасы: барлық пәндер, нөмірлер пән ішінде 1-ден */
  const answerMap = useMemo(
    () => (
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.subject}>
            <p className="mb-2 flex items-center justify-between text-sm font-bold">
              {section.title}
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {doneIn(section)}/{section.count}
              </span>
            </p>
            <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: section.count }, (_, k) => {
                const i = section.start + k;
                const a = answers[questionIds[i]];
                const answered = Boolean(a?.selected.length);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`${section.title}, ${t("questionN", { n: k + 1 })}${answered ? ` — ${t("answered")}` : ""}${a?.flagged ? ` — ${t("flagged")}` : ""}`}
                    aria-current={i === index ? "step" : undefined}
                    className={cn(
                      "relative grid aspect-square place-items-center rounded-lg text-xs font-bold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      answered ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground hover:bg-muted",
                      i === index && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                    )}
                  >
                    {k + 1}
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
    <div className="exam-backdrop min-h-dvh pb-28 lg:pb-10">
      {/* Брендтік су белгісі: сертификаттағыдай өте үлкен әрі өте әлсіз логотип (басуға кедергі жасамайды) */}
      <Image
        src="/logo.png"
        alt=""
        width={720}
        height={720}
        aria-hidden
        draggable={false}
        className="pointer-events-none fixed top-1/2 left-1/2 z-20 w-[80vmin] max-w-[720px] -translate-x-1/2 -translate-y-1/2 opacity-[0.045] select-none dark:opacity-[0.06]"
      />
      {/* Жоғарғы жолақ: мәзір, оқушы аты, таймер, келесі пән */}
      <header className="sticky top-0 z-30 bg-brand-gradient pt-[env(safe-area-inset-top)] text-white shadow-lg shadow-primary/20">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2.5 px-4 sm:gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("menu")}
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 transition-colors hover:bg-white/25 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <p className="min-w-0 truncate font-bold sm:text-lg">{state.studentName || state.title}</p>
          <div
            className={cn(
              "ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono font-bold tabular-nums sm:text-lg",
              lowTime ? "animate-pulse bg-danger text-white" : "bg-white/15",
            )}
            role="timer"
            aria-label={t("timeLeft")}
          >
            <Timer className="size-4 sm:size-5" aria-hidden />
            {formatClock(remaining)}
          </div>
          <span className="hidden items-center sm:flex" aria-live="polite" title={t(saveStatus)}>
            {saveStatus === "saving" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saveStatus === "saved" && <Check className="size-4" aria-hidden />}
            {saveStatus === "offline" && <CloudOff className="size-4 text-amber-200" aria-hidden />}
          </span>
          {nextSection ? (
            <Button size="lg" className="hidden h-10 rounded-full bg-white px-4 text-primary hover:bg-white/90 md:inline-flex" onClick={() => goTo(nextSection.start)}>
              {t("nextSection")}
              <ChevronRight aria-hidden />
            </Button>
          ) : (
            <Button size="lg" className="hidden h-10 rounded-full bg-white px-4 text-primary hover:bg-white/90 md:inline-flex" onClick={openFinish} disabled={finishing}>
              {t("finishTest")}
            </Button>
          )}
        </div>
      </header>

      {/* Ағымдағы пәннің сұрақ нөмірлері */}
      <nav className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 border-b bg-card/90 backdrop-blur-lg" aria-label={t("navigator")}>
        <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none]">
          {currentSection &&
            Array.from({ length: currentSection.count }, (_, k) => {
              const i = currentSection.start + k;
              const a = answers[questionIds[i]];
              const answered = Boolean(a?.selected.length);
              const active = i === index;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`${t("questionN", { n: k + 1 })}${answered ? ` — ${t("answered")}` : ""}${a?.flagged ? ` — ${t("flagged")}` : ""}`}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "relative grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold tabular-nums transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    answered ? "bg-primary text-primary-foreground" : "bg-secondary text-primary hover:bg-secondary/70",
                    active && "scale-105 ring-2 ring-foreground ring-offset-2 ring-offset-card",
                  )}
                >
                  {k + 1}
                  {a?.flagged && <span className="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-card bg-streak" aria-hidden />}
                </button>
              );
            })}
        </div>
      </nav>

      {saveStatus === "offline" && (
        <div className="mx-auto max-w-4xl px-4 pt-3">
          <FormMessage>{t("offline")}</FormMessage>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 pt-5">
        <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-gradient-to-r from-secondary/80 via-secondary/40 to-transparent px-5 py-3.5">
            <h1 className="min-w-0 text-base font-extrabold sm:text-lg">{t("section", { title: currentSection?.title ?? "" })}</h1>
            <span className="ml-auto text-sm font-semibold text-muted-foreground tabular-nums">
              {t("questionOf", { n: localNo, total: currentSection?.count ?? questionIds.length })}
            </span>
            <Button variant={current.flagged ? "secondary" : "ghost"} size="sm" onClick={toggleFlag} aria-pressed={current.flagged}>
              <Flag className={cn("size-4", current.flagged && "fill-streak text-streak")} aria-hidden />
              <span className="hidden sm:inline">{current.flagged ? t("unflag") : t("flag")}</span>
            </Button>
            <Button variant="brand" size="sm" className="hidden rounded-full sm:inline-flex" onClick={() => goTo(index + 1)} disabled={index === questionIds.length - 1}>
              {t("nextQuestion")}
              <ChevronRight aria-hidden />
            </Button>
          </div>

          <div key={index} className="animate-in fade-in slide-in-from-right-2 p-5 duration-300 sm:p-6">
            {instruction && (
              <p className="mb-4 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>
                  <b className="font-bold text-foreground">{t("instruction")}:</b> {t(`instr.${instruction}`)}
                </span>
              </p>
            )}
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
        </div>

        <div className="mt-4 hidden gap-3 lg:flex">
          <Button variant="outline" size="xl" onClick={() => goTo(index - 1)} disabled={index === 0}>
            <ArrowLeft aria-hidden />
            {t("prev")}
          </Button>
          <Button variant="secondary" size="xl" onClick={() => setNavOpen(true)}>
            <Grid3x3 aria-hidden />
            {t("answerMap")} · {t("answeredCount", { answered: answeredCount, total: questionIds.length })}
          </Button>
          <Button variant="brand" size="xl" className="ml-auto" onClick={() => goTo(index + 1)} disabled={index === questionIds.length - 1}>
            {t("nextQuestion")}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </main>

      {/* Телефонда — төменгі басқару панелі */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t bg-card/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden">
        <Button variant="outline" size="xl" className="px-4" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label={t("prev")}>
          <ArrowLeft aria-hidden />
        </Button>
        <Button variant="secondary" size="xl" className="flex-1" onClick={() => setNavOpen(true)}>
          <Grid3x3 aria-hidden />
          {t("answeredCount", { answered: answeredCount, total: questionIds.length })}
        </Button>
        <Button variant="brand" size="xl" className="px-4" onClick={() => goTo(index + 1)} disabled={index === questionIds.length - 1} aria-label={t("nextQuestion")}>
          <ArrowRight aria-hidden />
        </Button>
      </div>

      <ExamProctor attemptId={attemptId} questionNo={index + 1} />

      {/* Сол жақ мәзір: бөлімдер, жауап картасы, калькулятор, аяқтау */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[88vw] overflow-y-auto sm:max-w-sm">
          <SheetHeader className="bg-brand-gradient px-5 pt-6 pb-5 text-white">
            <SheetTitle className="text-lg font-extrabold text-white">{state.studentName || t("menu")}</SheetTitle>
            <p className="text-sm text-white/80">{state.title}</p>
          </SheetHeader>
          <div className="space-y-6 px-4 pb-6">
            <section>
              <p className="mb-2 px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">{t("sectionsTitle")}</p>
              <ul className="space-y-1.5">
                {sections.map((s) => {
                  const done = doneIn(s);
                  const active = currentSection?.subject === s.subject;
                  return (
                    <li key={s.subject}>
                      <button
                        type="button"
                        onClick={() => goTo(s.start)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "w-full rounded-2xl border-2 px-3.5 py-2.5 text-left transition-colors",
                          active ? "border-primary bg-secondary" : "border-transparent bg-muted/50 hover:bg-muted",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2 text-sm font-bold">
                          {s.title}
                          <span className="text-xs text-muted-foreground tabular-nums">{done}/{s.count}</span>
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-background">
                          <span className="block h-full rounded-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${(done / s.count) * 100}%` }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="grid gap-2">
              <Button variant="outline" size="xl" className="justify-start" onClick={() => { setMenuOpen(false); setNavOpen(true); }}>
                <Grid3x3 aria-hidden /> {t("answerMap")}
              </Button>
              <Button variant="outline" size="xl" className="justify-start" onClick={() => { setMenuOpen(false); setCalcOpen(true); }}>
                <CalculatorIcon aria-hidden /> {t("calculator")}
              </Button>
            </section>
            <Button variant="outline" size="xl" className="w-full border-danger/40 text-danger hover:bg-danger/10" onClick={openFinish} disabled={finishing}>
              <LogOut aria-hidden /> {t("finishTest")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-2xl overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold">{t("answerMap")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{answerMap}</div>
        </SheetContent>
      </Sheet>

      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="max-w-xs">
          <DialogTitle className="mb-3">{t("calculator")}</DialogTitle>
          <Calculator />
        </DialogContent>
      </Dialog>

      {/* Аяқтау: 1) жауаптар кестесі → 2) қарапайым мысал */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className={confirmStep === 1 ? "max-w-2xl" : "max-w-md"}>
          {confirmStep === 1 ? (
            <>
              <DialogTitle>{t("summaryTitle")}</DialogTitle>
              <div className="mt-4 overflow-x-auto rounded-2xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold">{t("colSection")}</th>
                      <th className="px-3 py-2 text-center font-bold">{t("colTotal")}</th>
                      <th className="px-3 py-2 text-center font-bold">{t("colAnswered")}</th>
                      <th className="px-3 py-2 text-center font-bold">{t("colEmpty")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y tabular-nums">
                    {sections.map((s) => {
                      const done = doneIn(s);
                      return (
                        <tr key={s.subject}>
                          <td className="px-3 py-2 font-semibold">{s.title}</td>
                          <td className="px-3 py-2 text-center">{s.count}</td>
                          <td className="px-3 py-2 text-center">{done}</td>
                          <td className={cn("px-3 py-2 text-center font-bold", s.count - done > 0 ? "bg-danger/10 text-danger" : "text-success")}>
                            {s.count - done}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {unanswered > 0 && <DialogDescription className="mt-3 text-sm">{t("finishConfirmText", { count: unanswered })}</DialogDescription>}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" size="xl" onClick={() => setConfirmOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button variant="brand" size="xl" onClick={toCaptcha}>
                  {t("confirm")}
                </Button>
              </div>
            </>
          ) : (
            <form onSubmit={submitCaptcha}>
              <DialogTitle className="text-center">{t("captchaTitle")}</DialogTitle>
              <DialogDescription className="mt-2 text-center">{t("captchaText", captcha)}</DialogDescription>
              <Input
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                value={captchaInput}
                onChange={(e) => {
                  setCaptchaInput(e.target.value.replace(/\D/g, "").slice(0, 3));
                  setCaptchaWrong(false);
                }}
                aria-label={t("captchaText", captcha)}
                aria-invalid={captchaWrong}
                className="mt-4 h-14 text-center text-2xl font-bold"
              />
              {captchaWrong && <p className="mt-2 text-center text-sm font-semibold text-danger">{t("captchaWrong")}</p>}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" size="xl" onClick={() => setConfirmOpen(false)}>
                  {t("close")}
                </Button>
                <Button type="submit" variant="brand" size="xl" disabled={!captchaInput || finishing}>
                  {finishing && <Loader2 className="animate-spin" aria-hidden />}
                  {t("finishNow")}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
