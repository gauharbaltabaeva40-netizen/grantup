import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ClipboardCheck, Clock, Lock, Timer } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { GradientCard } from "@/components/brand/gradient-card";
import { PageHeader } from "@/components/layout/page-header";
import { StartMockButton } from "@/components/mock/start-mock-button";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { getMockOverview } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("mockExam");
  return { title: t("title") };
}

export default async function MockExamPage() {
  const locale = await getLocale();
  const [t, format, overview] = await Promise.all([getTranslations("mockExam"), getFormatter(), getMockOverview(locale)]);

  if (!overview) {
    return (
      <FadeIn>
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState icon={ClipboardCheck} title={t("emptyTitle")} description={isSupabaseConfigured ? t("emptyText") : t("notConfigured")} />
      </FadeIn>
    );
  }

  return (
    <FadeIn className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      {overview.activeAttemptId && (
        <GradientCard>
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <Timer className="size-5" aria-hidden />
            {t("activeTitle")}
          </p>
          <p className="mt-1 text-white/85">{t("activeText")}</p>
          <Link href={`/exam/${overview.activeAttemptId}`} className={cn(buttonVariants({ variant: "white", size: "2xl" }), "mt-4 w-full sm:w-auto")}>
            {t("continue")}
            <ArrowRight aria-hidden />
          </Link>
        </GradientCard>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">{t("variants")}</h2>
        {overview.items.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={t("none")} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {overview.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-soft">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {item.isFree && <Badge className="bg-success text-white">{t("free")}</Badge>}
                    {item.locked && (
                      <Badge variant="secondary" className="gap-1">
                        <Lock className="size-3" aria-hidden />
                        {t("locked")}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-bold leading-snug">{item.title}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="size-4" aria-hidden />
                    {t("questions", { count: item.questionCount })}
                  </p>
                </div>
                <div className="mt-auto">
                  {item.locked ? (
                    <Link href="/upgrade" className={buttonVariants({ variant: "outline", size: "xl" })}>
                      <Lock aria-hidden />
                      {t("locked")}
                    </Link>
                  ) : overview.activeAttemptId ? null : (
                    <StartMockButton mockExamId={item.id} label={t("start")} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <h2 className="mb-3 font-bold">{t("rulesTitle")}</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-muted-foreground">
          {(["r1", "r2", "r3", "r4", "r5"] as const).map((key) => (
            <li key={key}>{t(`rules.${key}`)}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">{t("history")}</h2>
        {overview.history.length === 0 ? (
          <p className="rounded-2xl bg-card p-5 text-muted-foreground shadow-soft">{t("historyEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-2xl bg-card shadow-soft">
            {overview.history.map((h) => (
              <li key={h.attemptId}>
                <Link href={`/mock-exam/${h.attemptId}/result`} className="flex items-center gap-3 p-4 outline-none hover:bg-muted/50 focus-visible:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{h.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(h.finishedAt), { dateStyle: "medium", timeStyle: "short" })}
                      {h.status === "expired" && ` · ${t("expired")}`}
                    </p>
                  </div>
                  <span className="text-lg font-extrabold tabular-nums">{t("score", { score: h.score, max: h.maxScore })}</span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </FadeIn>
  );
}
