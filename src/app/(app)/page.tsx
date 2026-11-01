import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Flame, Target, Trophy } from "lucide-react";
import { ContinueButton } from "@/components/brand/continue-button";
import { GradientCard } from "@/components/brand/gradient-card";
import { ProgressRing } from "@/components/brand/progress-ring";
import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { demoStudent as s } from "@/lib/demo";
import { getTodayPlan } from "@/lib/plan/data";
import { planItemHref } from "@/lib/plan/types";
import { getViewer } from "@/lib/viewer";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const tp = await getTranslations("plan");
  const viewer = await getViewer();
  // Бүгінгі жоспар — оқушының белсенді жоспарынан; демо режимде макет. Болжамды балл — 9-кезеңде.
  const today = viewer?.demo ? null : await getTodayPlan();
  const plan = today ?? (viewer?.demo ? { ...s.plan, items: [] } : null);
  const planPercent = plan && plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
  const nextItem = today?.items.find((i) => !i.done);
  const continueHref = nextItem ? planItemHref(nextItem) : today ? "/plan" : "/lessons";
  const name = viewer?.name ?? s.name;
  const streak = viewer?.streak ?? 0;
  const xp = viewer?.xp ?? 0;
  const level = viewer?.level ?? 1;
  const targetScore = viewer?.targetScore ?? s.targetScore;

  return (
    <div className="space-y-5">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("greeting", { name })}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </FadeIn>

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
            <Link href="/plan" className="mt-3 block text-center text-sm font-semibold text-white/90 underline-offset-4 hover:underline sm:inline-block sm:ml-4 sm:text-left">
              {tp("title")} →
            </Link>
          )}
        </GradientCard>
      </FadeIn>

      <FadeIn delay={0.1} className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl shadow-soft ring-0">
          <CardContent className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-streak/12 text-streak">
              <Flame className="size-6 fill-streak/30" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{tc("streak")}</p>
              <p className="text-lg font-extrabold">{t("streakDays", { count: streak })}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-soft ring-0">
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("levelLabel", { level })}</p>
            <p className="text-lg font-extrabold">{xp} XP</p>
            <Progress value={s.levelProgress} aria-label={tc("level")} className="mt-2 [&_[data-slot=progress-indicator]]:bg-brand-gradient [&_[data-slot=progress-track]]:h-2" />
            <p className="mt-1.5 text-xs text-muted-foreground">{t("xpToNext", { xp: s.xpToNextLevel })}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-soft ring-0">
          <CardContent className="flex items-center gap-4">
            <ProgressRing value={s.predictedScore ?? 0} max={140} size={72} stroke={8}>
              <span className="text-base font-extrabold">{s.predictedScore ?? "—"}</span>
            </ProgressRing>
            <div>
              <p className="text-sm text-muted-foreground">{t("predictedScore")}</p>
              <p className="flex items-center gap-1 text-[15px] font-bold">
                <Target className="size-4 text-primary" aria-hidden />
                {t("targetScore", { score: targetScore })}
              </p>
              {s.predictedScore === null && <p className="mt-0.5 text-xs text-muted-foreground">{t("noScoreYet")}</p>}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.15} className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl shadow-soft ring-0">
          <CardHeader>
            <CardTitle className="text-base font-bold">{t("weakTopics")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{t("weakTopicsEmpty")}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-soft ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Trophy className="size-5 text-streak" aria-hidden />
              {t("league")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{t("leagueEmpty")}</p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
