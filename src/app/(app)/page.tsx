import { getTranslations } from "next-intl/server";
import { Flame, Target, Trophy } from "lucide-react";
import { ContinueButton } from "@/components/brand/continue-button";
import { GradientCard } from "@/components/brand/gradient-card";
import { ProgressRing } from "@/components/brand/progress-ring";
import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { demoStudent as s } from "@/lib/demo";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const planPercent = Math.round((s.plan.done / s.plan.total) * 100);

  return (
    <div className="space-y-5">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("greeting", { name: s.name })}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <GradientCard>
          <p className="text-sm font-semibold text-white/80">{t("todayPlan")}</p>
          <p className="mt-1 text-2xl font-extrabold sm:text-3xl">
            {t("todayPlanValue", { lessons: s.plan.lessons, questions: s.plan.questions })}
          </p>
          <Progress
            value={planPercent}
            aria-label={t("todayPlan")}
            className="mt-4 [&_[data-slot=progress-indicator]]:bg-white [&_[data-slot=progress-track]]:h-2.5 [&_[data-slot=progress-track]]:bg-white/25"
          />
          <p className="mt-2 text-sm font-medium text-white/85">
            {t("planProgress", { done: s.plan.done, total: s.plan.total })}
          </p>
          <ContinueButton href="/lessons" tone="white" className="mt-5">
            {tc("continue")}
          </ContinueButton>
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
              <p className="text-lg font-extrabold">{t("streakDays", { count: s.streak })}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-soft ring-0">
          <CardContent>
            <p className="text-sm text-muted-foreground">{t("levelLabel", { level: s.level })}</p>
            <p className="text-lg font-extrabold">{s.xp} XP</p>
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
                {t("targetScore", { score: s.targetScore })}
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
