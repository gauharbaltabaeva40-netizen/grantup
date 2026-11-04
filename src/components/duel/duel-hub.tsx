"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronRight, Dices, Loader2, Swords, UserPlus } from "lucide-react";
import { FormMessage } from "@/components/forms/fields";
import { createDuel } from "@/lib/duel/actions";
import { DUEL_SECONDS_PER_QUESTION, DUEL_WIN_XP, type DuelErrorKey, type DuelListItem, type DuelStatus } from "@/lib/duel/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<DuelStatus, string> = {
  play: "bg-primary text-primary-foreground",
  waiting: "bg-muted text-muted-foreground",
  won: "bg-success/15 text-success",
  lost: "bg-danger/10 text-danger",
  draw: "bg-streak/15 text-amber-700 dark:text-amber-300",
  expired: "bg-muted text-muted-foreground",
};

export function DuelHub({
  subjects,
  mixedAvailable,
  items,
  stats,
}: {
  subjects: { code: string; title: string }[];
  mixedAvailable: boolean;
  items: DuelListItem[];
  stats: { wins: number; losses: number; draws: number };
}) {
  const t = useTranslations("duel");
  const router = useRouter();
  const [subject, setSubject] = useState<string | null>(mixedAvailable ? null : (subjects[0]?.code ?? null));
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"friend" | "random" | null>(null);
  const [error, setError] = useState<DuelErrorKey | null>(null);
  const canPlay = mixedAvailable || subjects.length > 0;

  const start = (mode: "friend" | "random") => {
    setError(null);
    setBusy(mode);
    startTransition(async () => {
      const result = await createDuel({ mode, subjectCode: subject });
      if (result.ok) router.push(`/duel/${result.data.duelId}`);
      else {
        setError(result.error);
        setBusy(null);
      }
    });
  };

  const chip = (code: string | null, title: string) => (
    <button
      key={code ?? "mixed"}
      type="button"
      onClick={() => setSubject(code)}
      aria-pressed={subject === code}
      className={cn(
        "h-10 rounded-full border-2 px-4 text-sm font-semibold transition-colors",
        subject === code ? "border-primary bg-secondary text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {title}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Жаңа дуэль */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#0b1026] p-5 text-white shadow-brand sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 -z-10 size-72 animate-[float_12s_ease-in-out_infinite] rounded-full bg-[#0a84ff]/35 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-16 -bottom-24 -z-10 size-72 animate-[float_10s_ease-in-out_infinite_reverse] rounded-full bg-[#7b3ff2]/40 blur-3xl" />
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Swords className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-extrabold">{t("newTitle")}</h2>
            <p className="text-sm text-white/70">{t("rules", { s: DUEL_SECONDS_PER_QUESTION, xp: DUEL_WIN_XP })}</p>
          </div>
        </div>

        {canPlay && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-bold tracking-wide text-white/60 uppercase">{t("subject")}</p>
            <div className="flex flex-wrap gap-2 [&_button]:border-white/15 [&_button]:bg-white/5 [&_button]:text-white/80 [&_button[aria-pressed=true]]:border-white [&_button[aria-pressed=true]]:bg-white [&_button[aria-pressed=true]]:text-[#0b1026]">
              {mixedAvailable && chip(null, t("mixed"))}
              {subjects.map((s) => chip(s.code, s.title))}
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              { mode: "friend", icon: UserPlus, title: t("friend"), hint: t("friendHint"), tone: "from-[#0a84ff] to-[#0047ff]" },
              { mode: "random", icon: Dices, title: t("random"), hint: t("randomHint"), tone: "from-[#7b3ff2] to-[#db2777]" },
            ] as const
          ).map(({ mode, icon: Icon, title, hint, tone }) => (
            <button
              key={mode}
              type="button"
              onClick={() => start(mode)}
              disabled={pending || !canPlay}
              className={cn(
                "group flex items-center gap-3 rounded-2xl bg-gradient-to-br p-4 text-left shadow-lg transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-white/60 active:scale-[0.99] disabled:opacity-60",
                tone,
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/20">
                {busy === mode ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Icon className="size-5" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{title}</span>
                <span className="block text-sm text-white/80">{hint}</span>
              </span>
              <ChevronRight className="size-5 opacity-70 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          ))}
        </div>
        {!canPlay && <p className="mt-4 text-sm text-white/80">{t("errors.no_questions")}</p>}
        {error && (
          <div className="mt-4">
            <FormMessage>{t(`errors.${error}`)}</FormMessage>
          </div>
        )}
      </section>

      {/* Жеңістер */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["wins", stats.wins, "text-success"],
            ["losses", stats.losses, "text-danger"],
            ["draws", stats.draws, "text-amber-600 dark:text-amber-300"],
          ] as const
        ).map(([key, value, tone]) => (
          <div key={key} className="rounded-2xl bg-card p-4 text-center shadow-soft">
            <p className={cn("text-3xl font-extrabold tabular-nums", tone)}>{value}</p>
            <p className="text-xs font-semibold text-muted-foreground">{t(key)}</p>
          </div>
        ))}
      </div>

      {/* Тарих */}
      <section>
        <h2 className="mb-3 text-lg font-extrabold">{t("history")}</h2>
        {items.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-soft">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/duel/${item.id}`}
                  className="hover-lift flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-soft outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-xl" aria-hidden>
                    {item.opponent?.avatar ?? "⚔️"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{item.opponent?.name ?? t("noOpponent")}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.subjectTitle ?? t("mixed")}
                      {item.myCorrect !== null && ` · ${item.myCorrect}:${item.opponentCorrect ?? "–"}`}
                    </span>
                  </span>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", STATUS_TONE[item.status])}>{t(`status.${item.status}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
