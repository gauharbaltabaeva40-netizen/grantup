import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Flame, Lightbulb, RotateCcw, Snowflake, Swords, Target, Trophy } from "lucide-react";
import { ContinueButton } from "@/components/brand/continue-button";
import { GradientCard } from "@/components/brand/gradient-card";
import { ProgressRing } from "@/components/brand/progress-ring";
import { FadeIn } from "@/components/motion/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { demoStudent as s } from "@/lib/demo";
import { getLeagueView } from "@/lib/gamification/data";
import { getGrantOverview } from "@/lib/grant/data";
import { getTodayPlan } from "@/lib/plan/data";
import { planItemHref } from "@/lib/plan/types";
import { cn } from "@/lib/utils";
import { getViewer } from "@/lib/viewer";

const cardClass = "rounded-2xl shadow-soft ring-0";

export default async function HomePage() {
  const [t, tc, tp, tl, td, locale, viewer] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getTranslations("plan"),
    getTranslations("leagueView"),
    getTranslations("duel"),
    getLocale(),
    getViewer(),
  ]);
  const live = Boolean(viewer && !viewer.demo);

  // Демо режимде — макет; әйтпесе нақты деректер
  const [today, grant, league] = live
    ? await Promise.all([getTodayPlan(), getGrantOverview(locale), getLeagueView(locale)])
    : [null, null, null];

  const plan = today ?? (live ? null : { ...s.plan, items: [] });
  const planPercent = plan && plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
  const nextItem = today?.items.find((i) => !i.done);
  const continueHref = nextItem ? planItemHref(nextItem) : today ? "/plan" : "/lessons";

  const name = viewer?.name ?? s.name;
  const level = viewer?.level;
  const prediction = grant?.prediction ?? null;
  const target = grant?.target ?? (live ? null : s.targetScore);
  const maxScore = grant?.maxScore ?? 140;
  const me = league?.standings.find((m) => m.isMe);

  return (
    <div className="space-y-5">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("greeting", { name })}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </FadeIn>

      {/* 1. Бүгінгі жоспар — басты әрекет */}
      <FadeIn delay={0.05}>
        <GradientCard>
          <p className="text-sm font-semibold text-white/80">{t("todayPlan")}</p>
          {plan && plan.total > 0 ? (
            <>
              <p className="mt-1 text-2xl font-extrabold sm:text-3xl">
                {t("todayPlanValue", { lessons: plan.lessons, questions: plan.questions })}
              </p>
              <Progress
                value={planPercent}
                aria-label={t("todayPlan")}
                className="mt-4 [&_[data-slot=progress-indicator]]:bg-white [&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-track]]:bg-white/25"
              />
              <p className="mt-2 text-sm font-medium text-white/85">{t("planProgress", { done: plan.done, total: plan.total })}</p>
            </>
          ) : (
            <p className="mt-1 text-lg font-bold">{tp(today ? "todayEmpty" : "emptyText")}</p>
          )}
          <ContinueButton href={continueHref} tone="white" className="mt-5">
            {tc("continue")}
          </ContinueButton>
          {today && (
            <Link href="/plan" className="mt-3 block text-center text-sm font-semibold text-white/90 underline-offset-4 hover:underline sm:ml-4 sm:inline-block sm:text-left">
              {tp("title")} →
            </Link>
          )}
        </GradientCard>
      </FadeIn>

      {/* 2. Грантқа дейінгі жол */}
      <FadeIn delay={0.1}>
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Target className="size-5 text-primary" aria-hidden />
              {t("grantPath")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ProgressRing value={prediction?.score ?? 0} max={target || maxScore} size={120} stroke={11} className="mx-auto sm:mx-0">
              <span>
                <span className="block text-3xl font-extrabold tabular-nums">{prediction?.score ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{t("outOf", { max: maxScore })}</span>
              </span>
            </ProgressRing>
            <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                {t("predictedScore")}
                {prediction && ` · ${prediction.basis === "mock" ? t("basisMock") : t("basisPractice")}`}
              </p>
              {target !== null ? (
                <p className="font-bold">
                  {t("targetScore", { score: target })}
                  {grant?.specialty && (
                    <span className="block text-sm font-medium text-muted-foreground">
                      {t("specialty", { name: grant.specialty.name, score: grant.specialty.threshold })}
                    </span>
                  )}
                </p>
              ) : (
                <Link href="/profile#goal" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  {t("setGoal")}
                </Link>
              )}
              {prediction && grant?.gap != null && (
                <p className={cn("text-[15px] font-semibold", grant.gap <= 0 ? "text-success" : "text-foreground")}>
                  {grant.gap <= 0 ? t("gapReached") : t("gapLeft", { gap: grant.gap })}
                </p>
              )}
              {!prediction && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t("noPrediction")}</p>
                  <Link href="/mock-exam" className={buttonVariants({ variant: "outline", size: "lg" })}>
                    {t("takeMock")}
                    <ArrowRight aria-hidden />
                  </Link>
                </div>
              )}
              {grant?.advice && (
                <p className="flex items-start gap-2 rounded-xl bg-streak/10 p-3 text-left text-sm font-medium">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-streak" aria-hidden />
                  {t("advice", { subject: grant.advice.subjectTitle, gain: grant.advice.gain })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 3. Streak және деңгей */}
      <FadeIn delay={0.15} className="grid gap-4 sm:grid-cols-2">
        <Card className={cardClass}>
          <CardContent className="flex items-center gap-4">
            <div
              className={cn(
                "grid size-12 place-items-center rounded-2xl",
                (viewer?.streak ?? 0) > 0 ? "bg-streak/12 text-streak" : "bg-muted text-muted-foreground",
              )}
            >
              <Flame className={cn("size-6", (viewer?.streak ?? 0) > 0 && "fill-streak/30")} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">{tc("streak")}</p>
              <p className="text-lg font-extrabold">{t("streakDays", { count: viewer?.streak ?? 0 })}</p>
            </div>
            {(viewer?.streakFreezes ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-brand-sky/12 px-2.5 py-1 text-xs font-bold text-brand-sky" title="Streak freeze">
                <Snowflake className="size-3.5" aria-hidden />
                {viewer?.streakFreezes}
              </span>
            )}
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("levelLabel", { level: level?.level ?? 1 })}
              {level?.name ? ` · ${level.name}` : ""}
            </p>
            <p className="text-lg font-extrabold">{viewer?.xp ?? 0} XP</p>
            <Progress
              value={level?.progress ?? 0}
              aria-label={tc("level")}
              className="mt-2 [&_[data-slot=progress-indicator]]:bg-brand-gradient [&_[data-slot=progress-track]]:h-2"
            />
            {level?.xpToNext != null && <p className="mt-1.5 text-xs text-muted-foreground">{t("xpToNext", { xp: level.xpToNext })}</p>}
          </CardContent>
        </Card>
      </FadeIn>

      {/* 4. Әлсіз тақырыптар және лига */}
      <FadeIn delay={0.2} className="grid gap-4 md:grid-cols-2">
        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="text-base font-bold">{t("weakTopics")}</CardTitle>
          </CardHeader>
          <CardContent>
            {grant?.weakTopics.length ? (
              <ul className="space-y-2">
                {grant.weakTopics.map((topic) => (
                  <li key={topic.topicId} className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{topic.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {topic.subjectTitle} · <span className="font-semibold text-danger">{t("accuracy", { percent: topic.accuracy })}</span>
                      </p>
                    </div>
                    <Link href={`/practice/${topic.subjectCode}?topic=${topic.topicId}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                      <RotateCcw aria-hidden />
                      {t("repeat")}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                {grant && grant.stats.answered >= 10 ? t("weakTopicsNone") : t("weakTopicsEmpty")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Trophy className="size-5 text-streak" aria-hidden />
              {t("league")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {league && me ? (
              <Link href="/league" className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <span className="grid size-12 place-items-center rounded-2xl text-lg font-extrabold text-white" style={{ backgroundColor: league.tier.color }}>
                  {me.rank}
                </span>
                <span>
                  <span className="block font-bold">{league.tier.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {tl("rank", { rank: me.rank })} · {tl("weeklyXp", { xp: me.weeklyXp })}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="text-[15px] leading-relaxed text-muted-foreground">{t("leagueEmpty")}</p>
            )}
          </CardContent>
        </Card>

        {/* Дуэль: досыңмен немесе кездейсоқ қарсыласпен 5 сұрақ */}
        <Link
          href="/duel"
          className="hover-lift relative isolate flex items-center gap-4 overflow-hidden rounded-2xl bg-[#0b1026] p-5 text-white shadow-brand outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:col-span-2"
        >
          <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 -z-10 size-48 animate-[float_10s_ease-in-out_infinite] rounded-full bg-[#7b3ff2]/45 blur-3xl" />
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#fb923c] to-[#ef4444] shadow-lg">
            <Swords className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold">{td("homeTitle")}</span>
            <span className="block text-sm text-white/75">{td("homeText")}</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-[#0b1026] sm:inline-flex">
            {td("homeCta")} <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>
      </FadeIn>
    </div>
  );
}
