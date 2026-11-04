"use client";

/**
 * Дуэль экраны: лобби (VS + ережелер) → ойын (5 сұрақ, әрқайсысына таймер) → нәтиже.
 * Жауап серверде тексеріледі; дұрыс жауап клиентке тек жауап бергеннен кейін келеді.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Copy, Handshake, Hourglass, Loader2, Share2, Swords, Target, Timer, Trophy, X } from "lucide-react";
import { FormMessage } from "@/components/forms/fields";
import { QuestionCard } from "@/components/quiz/question-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { answerDuel, finishDuelRound, getDuelQuestion, startDuelRound } from "@/lib/duel/actions";
import type { DuelErrorKey, DuelSide, DuelState } from "@/lib/duel/types";
import type { QuizQuestion } from "@/lib/quiz/types";
import { cn } from "@/lib/utils";

const FEEDBACK_MS = 1100;

function Avatar({ side, label, highlight }: { side: Pick<DuelSide, "name" | "avatar"> | null; label?: string; highlight?: boolean }) {
  const t = useTranslations("duel");
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-full bg-white/10 text-3xl ring-2 sm:size-16",
          highlight ? "ring-amber-300 shadow-[0_0_24px_rgba(252,211,77,0.45)]" : "ring-white/20",
        )}
        aria-hidden
      >
        {side ? (side.avatar ?? "🙂") : <Hourglass className="size-6 animate-pulse text-white/60" />}
      </span>
      <span className="w-full min-w-0">
        <span className="block truncate text-sm font-extrabold sm:text-base">{side?.name ?? t("noOpponent")}</span>
        {label && <span className="block text-[11px] font-semibold text-white/55">{label}</span>}
      </span>
    </div>
  );
}

/** Сахна: қараңғы градиент, VS тақырыбы */
function Stage({ state, children, myLive }: { state: DuelState; children?: React.ReactNode; myLive?: number }) {
  const t = useTranslations("duel");
  const done = ["won", "lost", "draw"].includes(state.status);
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-[#0b1026] p-5 text-white shadow-brand sm:p-7">
      <div aria-hidden className="pointer-events-none absolute -top-28 -left-20 -z-10 size-80 animate-[float_12s_ease-in-out_infinite] rounded-full bg-[#0a84ff]/35 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 -bottom-28 -z-10 size-80 animate-[float_10s_ease-in-out_infinite_reverse] rounded-full bg-[#7b3ff2]/40 blur-3xl" />
      <div className="flex items-center gap-3">
        <Avatar side={state.me} label={t("you")} highlight={state.status === "won"} />
        <div className="shrink-0 text-center">
          {done || myLive !== undefined ? (
            <p className="text-3xl font-extrabold tabular-nums sm:text-4xl">
              {myLive ?? state.me.correct ?? 0}
              <span className="mx-1.5 text-white/40">:</span>
              {done ? (state.opponent?.correct ?? 0) : "?"}
            </p>
          ) : (
            <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-[#fb923c] to-[#ef4444] text-sm font-black tracking-wider shadow-lg">
              {t("vs")}
            </span>
          )}
          {state.subjectTitle !== undefined && <p className="mt-1 text-[11px] font-semibold text-white/60">{state.subjectTitle ?? t("mixed")}</p>}
        </div>
        <Avatar side={state.opponent} highlight={state.status === "lost"} />
      </div>
      {children}
    </div>
  );
}

/** Шақыру сілтемесі: көшіру / бөлісу (браузердің өз бөлісу терезесі) */
function InvitePanel({ code }: { code: string }) {
  const t = useTranslations("duel");
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${window.location.origin}/duel/join/${code}`), [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  const share = async () => {
    try {
      await navigator.share({ title: "GrantUp", text: t("shareText"), url });
    } catch {}
  };

  return (
    <div className="rounded-3xl border bg-card p-5 shadow-soft">
      <p className="font-extrabold">{t("inviteTitle")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("inviteText")}</p>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-muted px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{url}</span>
        <span className="shrink-0 rounded-lg bg-background px-2 py-1 font-mono text-xs font-bold tracking-widest">{code}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={copy} disabled={!url}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("copied") : t("copy")}
        </Button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <Button variant="brand" size="lg" className="flex-1" onClick={share} disabled={!url}>
            <Share2 aria-hidden />
            {t("share")}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Сұрақ таймері: сақина */
function CountdownRing({ left, total }: { left: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, left / total));
  const low = left <= 10;
  return (
    <div className="relative grid size-14 place-items-center" role="timer" aria-live="off">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className="stroke-white/15" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className={cn("transition-[stroke-dashoffset] duration-1000 ease-linear", low ? "stroke-[#f87171]" : "stroke-white")}
        />
      </svg>
      <span className={cn("text-lg font-extrabold tabular-nums", low && "animate-pulse text-[#fca5a5]")}>{Math.ceil(left)}</span>
    </div>
  );
}

function Marks({ marks, label }: { marks: (boolean | null)[]; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate text-xs font-semibold text-white/70">{label}</span>
      <div className="flex gap-1.5">
        {marks.map((m, i) => (
          <span
            key={i}
            className={cn(
              "grid size-7 place-items-center rounded-lg",
              m === true ? "bg-emerald-500/90" : m === false ? "bg-red-500/85" : "bg-white/10",
            )}
          >
            {m === true ? <Check className="size-4" strokeWidth={3} /> : m === false ? <X className="size-4" strokeWidth={3} /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Жеңіс конфеттиі (тек CSS; «анимацияны азайту» қосулы болса — өшеді) */
function Confetti() {
  const colors = ["#fcd34d", "#60a5fa", "#a78bfa", "#34d399", "#f472b6"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 24 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-2.5 w-1.5 animate-[confetti-fall_2.4s_ease-in_forwards] rounded-sm opacity-0"
          style={{ left: `${(i * 41) % 100}%`, backgroundColor: colors[i % colors.length], animationDelay: `${(i % 8) * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export function DuelArena({ initial }: { initial: DuelState }) {
  const t = useTranslations("duel");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<DuelErrorKey | null>(null);

  // --- ойын күйі
  const [playing, setPlaying] = useState(Boolean(initial.attemptId));
  const [index, setIndex] = useState(initial.nextIndex);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [left, setLeft] = useState(initial.secondsPerQuestion);
  const [phase, setPhase] = useState<"answer" | "feedback" | "timeout" | "finishing">("answer");
  const [marks, setMarks] = useState<(boolean | null)[]>(initial.me.marks);
  const [chosen, setChosen] = useState<string | null>(null);
  const offset = useRef(new Date(initial.serverNow).getTime() - Date.now());
  const deadline = useRef(initial.deadlineAt ? new Date(initial.deadlineAt).getTime() : 0);
  const questionStarted = useRef(Date.now());
  const lockRef = useRef(false);

  const finish = useCallback(async () => {
    setPhase("finishing");
    await finishDuelRound(initial.id);
    setPlaying(false);
    router.refresh();
  }, [initial.id, router]);

  const goNext = useCallback(
    (from: number) => {
      const next = from + 1;
      if (next >= initial.total) void finish();
      else setIndex(next);
    },
    [finish, initial.total],
  );

  // Сұрақты жүктеу
  useEffect(() => {
    if (!playing || index >= initial.total) {
      if (playing && index >= initial.total) void finish();
      return;
    }
    let cancelled = false;
    setQuestion(null);
    setChosen(null);
    setPhase("answer");
    lockRef.current = false;
    void getDuelQuestion(initial.id, index).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setQuestion(result.data);
        questionStarted.current = Date.now();
        setLeft(initial.secondsPerQuestion);
      } else if (result.error === "time_over") void finish();
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [playing, index, initial.id, initial.total, initial.secondsPerQuestion, finish]);

  // Таймер: сұрақтың 30 секунды және жалпы мерзім
  useEffect(() => {
    if (!playing || !question || phase !== "answer") return;
    const id = setInterval(() => {
      const perQuestion = initial.secondsPerQuestion - (Date.now() - questionStarted.current) / 1000;
      const overall = (deadline.current - (Date.now() + offset.current)) / 1000;
      const remaining = Math.min(perQuestion, overall);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0 && !lockRef.current) {
        lockRef.current = true;
        setPhase("timeout");
        setMarks((m) => m.map((v, i) => (i === index ? null : v)));
        setTimeout(() => (overall <= 0 ? void finish() : goNext(index)), 900);
      }
    }, 250);
    return () => clearInterval(id);
  }, [playing, question, phase, index, initial.secondsPerQuestion, finish, goNext]);

  const choose = (optionId: string) => {
    if (!question || phase !== "answer" || lockRef.current) return;
    lockRef.current = true;
    setChosen(optionId);
    setPhase("feedback");
    void answerDuel({ duelId: initial.id, questionId: question.questionId, selected: [optionId] }).then((result) => {
      if (result.ok) {
        setQuestion((q) => (q ? { ...q, feedback: result.data } : q));
        setMarks((m) => m.map((v, i) => (i === index ? result.data.isCorrect : v)));
        setTimeout(() => goNext(index), FEEDBACK_MS);
      } else if (result.error === "time_over") void finish();
      else {
        setError(result.error);
        lockRef.current = false;
        setChosen(null);
        setPhase("answer");
      }
    });
  };

  const begin = () => {
    setError(null);
    startTransition(async () => {
      const result = await startDuelRound(initial.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      deadline.current = Date.now() + offset.current + (initial.total * initial.secondsPerQuestion + 20) * 1000;
      setIndex(0);
      setMarks(initial.me.marks.map(() => null));
      setPlaying(true);
    });
  };

  // Қарсыласты күткенде нәтижені анда-санда жаңартамыз
  useEffect(() => {
    if (playing || initial.status !== "waiting") return;
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [playing, initial.status, router]);

  const myLive = marks.filter(Boolean).length;
  const showInvite = initial.isCreator && !initial.isOpen && !initial.opponent;

  // ------------------------------------------------------------ ойын
  if (playing) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Stage state={initial} myLive={myLive}>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex flex-1 gap-1.5" aria-label={t("questionOf", { n: Math.min(index + 1, initial.total), total: initial.total })}>
              {marks.map((m, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-colors duration-300",
                    m === true ? "bg-emerald-400" : m === false ? "bg-red-400" : i === index ? "bg-white" : "bg-white/15",
                  )}
                />
              ))}
            </div>
            <CountdownRing left={left} total={initial.secondsPerQuestion} />
          </div>
        </Stage>

        <div className="rounded-3xl bg-card p-5 shadow-soft sm:p-6">
          <div className="mb-3 flex items-center justify-between text-sm font-bold text-muted-foreground">
            <span>{t("questionOf", { n: Math.min(index + 1, initial.total), total: initial.total })}</span>
            {phase === "timeout" && (
              <span className="flex items-center gap-1 text-danger">
                <Timer className="size-4" aria-hidden /> {t("timeUp")}
              </span>
            )}
            {phase === "feedback" && question?.feedback && (
              <span className={cn("animate-in zoom-in-95 fade-in duration-200", question.feedback.isCorrect ? "text-success" : "text-danger")}>
                {question.feedback.isCorrect ? t("correct") : t("wrong")}
              </span>
            )}
          </div>
          {error && <FormMessage>{t(`errors.${error}`)}</FormMessage>}
          {question && phase !== "finishing" ? (
            <div key={question.questionId} className="animate-in fade-in slide-in-from-right-3 duration-300">
              <QuestionCard question={question} selected={chosen ? [chosen] : []} onToggle={choose} />
            </div>
          ) : (
            <div className="grid min-h-52 place-items-center" aria-busy>
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ лобби
  if (initial.status === "play") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Stage state={initial}>
          <div className="mt-6 text-center">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{t("lobbyTitle")}</h1>
            <ul className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm text-white/85">
              {[t("rule1", { n: initial.total, s: initial.secondsPerQuestion }), t("rule2"), t("rule3")].map((rule) => (
                <li key={rule} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden />
                  {rule}
                </li>
              ))}
            </ul>
            <Button variant="white" size="2xl" className="hover-lift mt-6 w-full max-w-xs" onClick={begin} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Swords aria-hidden />}
              {t("start")}
            </Button>
            {!initial.opponent && <p className="mx-auto mt-4 max-w-sm text-xs text-white/60">{t("firstPlayer")}</p>}
          </div>
        </Stage>
        {error && <FormMessage>{t(`errors.${error}`)}</FormMessage>}
        {showInvite && <InvitePanel code={initial.code} />}
      </div>
    );
  }

  // ------------------------------------------------------------ нәтиже / күту
  const view = {
    won: { icon: Trophy, title: t("resultWon"), text: t("wonText"), tone: "from-amber-300 to-orange-500" },
    lost: { icon: Target, title: t("resultLost"), text: t("lostText"), tone: "from-slate-400 to-slate-600" },
    draw: { icon: Handshake, title: t("resultDraw"), text: t("wonText"), tone: "from-sky-400 to-violet-500" },
    waiting: { icon: Hourglass, title: t("resultWaiting"), text: t("waitingText"), tone: "from-sky-400 to-blue-600" },
    expired: { icon: Hourglass, title: t("status.expired"), text: t("expiredText"), tone: "from-slate-400 to-slate-600" },
    play: { icon: Swords, title: "", text: "", tone: "" },
  }[initial.status];
  const Icon = view.icon;
  const done = ["won", "lost", "draw"].includes(initial.status);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Stage state={initial}>
        {initial.status === "won" && <Confetti />}
        <div className="relative mt-6 text-center">
          <span className={cn("mx-auto grid size-16 animate-in zoom-in-50 place-items-center rounded-2xl bg-gradient-to-br shadow-lg duration-500", view.tone)}>
            <Icon className="size-8" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold sm:text-3xl">{view.title}</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-white/75">{view.text}</p>
          {initial.xpWon > 0 && (
            <p className="mx-auto mt-3 inline-flex animate-in fade-in slide-in-from-bottom-2 rounded-full bg-amber-300 px-3 py-1 text-sm font-extrabold text-[#0b1026] duration-700">
              {t("xp", { xp: initial.xpWon })}
            </p>
          )}
        </div>
        <div className="mt-6 space-y-2 rounded-2xl bg-white/5 p-4">
          <Marks marks={initial.me.marks} label={t("you")} />
          {initial.opponent && <Marks marks={done ? initial.opponent.marks : initial.opponent.marks.map(() => null)} label={initial.opponent.name} />}
          <p className="pt-1 text-xs text-white/60">
            {t("correctOf", { correct: initial.me.correct ?? 0, total: initial.total })}
            {initial.me.seconds !== null && ` · ${t("seconds", { s: initial.me.seconds })}`}
            {done && initial.opponent?.seconds != null && ` — ${initial.opponent.name}: ${t("correctOf", { correct: initial.opponent.correct ?? 0, total: initial.total })} · ${t("seconds", { s: initial.opponent.seconds })}`}
          </p>
        </div>
      </Stage>

      {showInvite && initial.status === "waiting" && <InvitePanel code={initial.code} />}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/duel" className={buttonVariants({ variant: "brand", size: "xl", className: "flex-1" })}>
          <Swords aria-hidden />
          {t("again")}
        </Link>
        {initial.status === "lost" && (
          <Link href="/practice/mistakes" className={buttonVariants({ variant: "outline", size: "xl", className: "flex-1" })}>
            {tNav("mistakes")}
          </Link>
        )}
      </div>
    </div>
  );
}
