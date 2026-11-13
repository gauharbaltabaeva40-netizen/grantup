import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, BadgeCheck, BookOpen, Clock, Grid3x3, LineChart, ListChecks, Target, TriangleAlert } from "lucide-react";
import { ProgressRing } from "@/components/brand/progress-ring";
import { BarList, TopicHeatmap } from "@/components/mock/charts";
import { HistoryChart } from "@/components/mock/history-chart";
import { FadeIn } from "@/components/motion/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { getMockAnalytics } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ attemptId: string }> };

export async function generateMetadata() {
  const t = await getTranslations("mockExam.result");
  return { title: t("title") };
}

function Card({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-soft sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <Icon className="size-5 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function MockResultPage({ params }: Params) {
  const { attemptId } = await params;
  const locale = await getLocale();
  const [t, tm, format, data, tc] = await Promise.all([
    getTranslations("mockExam.result"),
    getTranslations("mockExam"),
    getFormatter(),
    getMockAnalytics(attemptId, locale),
    getTranslations("certificate"),
  ]);
  if (!data) notFound();

  const minutes = (seconds: number) => Math.round(seconds / 60);
  const maxTime = Math.max(...data.sections.map((s) => s.seconds), 60);
  const heatGroups = data.sections
    .map((s) => ({ title: s.title, topics: data.topics.filter((tp) => tp.subjectCode === s.code).map((tp) => ({ ...tp, id: tp.topicId })) }))
    .filter((g) => g.topics.length > 0);

  return (
    <FadeIn className="mx-auto max-w-4xl space-y-5">
      <Link href="/mock-exam" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("backToList")}
      </Link>

      {/* Жалпы балл — беттің басты саны */}
      <section className="flex flex-col items-center gap-5 rounded-2xl bg-card p-6 text-center shadow-soft sm:flex-row sm:text-left">
        <ProgressRing value={data.score} max={data.maxScore || 1} size={132} stroke={12}>
          <span>
            <span className="block text-4xl font-extrabold tabular-nums">{data.score}</span>
            <span className="text-xs text-muted-foreground">{t("outOf", { max: data.maxScore })}</span>
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {data.title} · {format.dateTime(new Date(data.finishedAt), { dateStyle: "medium", timeStyle: "short" })}
          </p>
          {data.status === "expired" && (
            <p className="flex items-center gap-2 text-sm font-medium text-streak">
              <TriangleAlert className="size-4" aria-hidden />
              {t("expiredNote")}
            </p>
          )}
          {data.maxScore < data.officialMax && (
            <p className="text-sm text-muted-foreground">
              {t("demoNote", { count: data.totalQuestions, max: data.maxScore, official: data.officialMax })}
            </p>
          )}
          <Link href={`/mock-exam/${data.attemptId}/review`} className={cn(buttonVariants({ variant: "brand", size: "xl" }), "mt-2")}>
            <ListChecks aria-hidden />
            {t("review")}
          </Link>
          <Link href={`/mock-exam/${data.attemptId}/certificate`} className={cn(buttonVariants({ variant: "outline", size: "xl" }), "mt-2")}>
            <BadgeCheck aria-hidden />
            {tc("resultButton")}
          </Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card icon={Target} title={t("bySubject")}>
          <BarList
            ariaLabel={t("bySubject")}
            max={1}
            rows={data.sections.map((s) => ({
              key: s.code,
              label: s.title,
              value: s.score,
              max: s.max,
              hint: t("correctOf", { correct: s.correct, total: s.total }),
            }))}
            formatValue={(r) => `${r.value} / ${r.max}`}
          />
        </Card>

        <Card icon={Clock} title={t("timeTitle")}>
          <BarList
            ariaLabel={t("timeTitle")}
            max={maxTime}
            rows={data.sections.map((s) => ({ key: s.code, label: s.title, value: s.seconds }))}
            formatValue={(r) => t("minutes", { count: minutes(r.value) })}
          />
        </Card>
      </div>

      <Card icon={TriangleAlert} title={t("weakTitle")}>
        {data.weakTopics.length === 0 ? (
          <p className="text-muted-foreground">{t("weakEmpty")}</p>
        ) : (
          <ol className="space-y-2">
            {data.weakTopics.map((topic, i) => (
              <li key={topic.topicId} className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-danger/10 text-sm font-bold text-danger">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{topic.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {topic.subjectTitle} · {topic.percent}%
                  </p>
                </div>
                {topic.lessonHref && (
                  <Link href={topic.lessonHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
                    <BookOpen aria-hidden />
                    <span className="hidden sm:inline">{t("toLesson")}</span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {heatGroups.length > 0 && (
        <Card icon={Grid3x3} title={t("topicsTitle")}>
          <TopicHeatmap groups={heatGroups} legendLow="0%" legendHigh="100%" />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-muted-foreground">{t("tableView")}</summary>
            <table className="mt-3 w-full text-left">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 font-semibold">{t("topic")}</th>
                  <th className="py-2 text-right font-semibold">{t("percent")}</th>
                </tr>
              </thead>
              <tbody>
                {data.topics.map((tp) => (
                  <tr key={tp.topicId} className="border-b last:border-0">
                    <td className="py-2">{tp.title}</td>
                    <td className="py-2 text-right tabular-nums">
                      {tp.percent}% ({tp.correct}/{tp.total})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
      )}

      <Card icon={LineChart} title={t("historyTitle")}>
        {data.history.length < 2 ? (
          <p className="text-muted-foreground">{t("historyOnlyOne")}</p>
        ) : (
          <>
            <HistoryChart points={data.history} yMax={data.officialMax} ariaLabel={t("historyTitle")} />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-muted-foreground">{t("tableView")}</summary>
              <table className="mt-3 w-full text-left">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 font-semibold">{t("date")}</th>
                    <th className="py-2 text-right font-semibold">{t("points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.attemptId} className="border-b last:border-0">
                      <td className="py-2">
                        {format.dateTime(new Date(h.finishedAt), { dateStyle: "medium" })}
                        {h.current && <span className="text-muted-foreground"> · {t("current")}</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{tm("score", { score: h.score, max: h.maxScore })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </Card>

      <Link href="/mock-exam" className={cn(buttonVariants({ variant: "outline", size: "2xl" }), "w-full")}>
        {t("backToList")}
        <ArrowRight aria-hidden />
      </Link>
    </FadeIn>
  );
}
