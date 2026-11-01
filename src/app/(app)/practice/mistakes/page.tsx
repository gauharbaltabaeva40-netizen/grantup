import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, PartyPopper } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { Markdown } from "@/components/content/markdown";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/motion/fade-in";
import { MistakesRunner } from "@/components/practice/mistakes-runner";
import { Protected } from "@/components/protection/protection";
import { Badge } from "@/components/ui/badge";
import { getOpenMistakes } from "@/lib/practice/data";
import { getSetting } from "@/lib/settings";

export async function generateMetadata() {
  const t = await getTranslations("practice.mistakes");
  return { title: t("title") };
}

export default async function MistakesPage() {
  const locale = await getLocale();
  const [t, tp, format, mistakes, xp] = await Promise.all([
    getTranslations("practice.mistakes"),
    getTranslations("practice"),
    getFormatter(),
    getOpenMistakes(locale),
    getSetting("xp"),
  ]);

  const subjects = [...new Map(mistakes.map((m) => [m.subjectCode, m.subjectTitle])).entries()].map(([code, title]) => ({
    code,
    title,
    count: mistakes.filter((m) => m.subjectCode === code).length,
  }));

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-5">
      <Link href="/practice" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {tp("title")}
      </Link>
      <PageHeader title={t("title")} description={t("description")} />

      {mistakes.length === 0 ? (
        <EmptyState icon={PartyPopper} title={t("emptyTitle")} description={t("emptyText")} />
      ) : (
        <Protected className="space-y-5">
          <section className="rounded-2xl bg-card p-5 shadow-soft sm:p-6">
            <MistakesRunner subjects={subjects} total={mistakes.length} bonusXp={xp.mistakeFixed} />
          </section>

          <section aria-label={t("title")}>
            <h2 className="mb-3 font-bold">{t("count", { count: mistakes.length })}</h2>
            <ul className="space-y-2">
              {mistakes.slice(0, 50).map((m) => (
                <li key={m.questionId} className="rounded-2xl bg-card p-4 shadow-soft">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">{m.subjectTitle}</Badge>
                    <span className="font-semibold text-danger">{t("wrongTimes", { count: m.wrongCount })}</span>
                    <span className="text-muted-foreground">{format.dateTime(new Date(m.lastWrongAt), { dateStyle: "medium" })}</span>
                  </div>
                  <div className="line-clamp-3">
                    <Markdown inline className="text-[15px]">
                      {m.stem}
                    </Markdown>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </Protected>
      )}
    </FadeIn>
  );
}
