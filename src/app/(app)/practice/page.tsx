import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, ListChecks, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SubjectIcon } from "@/components/lessons/subject-icon";
import { FadeIn } from "@/components/motion/fade-in";
import { isSupabaseConfigured } from "@/lib/env";
import { getOpenMistakes, getPracticeCatalog } from "@/lib/practice/data";

export async function generateMetadata() {
  const t = await getTranslations("practice");
  return { title: t("title") };
}

export default async function PracticePage() {
  const locale = await getLocale();
  const [t, subjects, mistakes] = await Promise.all([
    getTranslations("practice"),
    getPracticeCatalog(locale),
    getOpenMistakes(locale),
  ]);

  return (
    <FadeIn className="space-y-5">
      <PageHeader title={t("title")} description={t("description")} />

      <Link
        href="/practice/mistakes"
        className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-soft hover-lift outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger">
          <RotateCcw className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{t("mistakes.title")}</p>
          <p className="text-sm text-muted-foreground">
            {mistakes.length > 0 ? t("mistakes.count", { count: mistakes.length }) : t("mistakes.emptyTitle")}
          </p>
        </div>
        <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
      </Link>

      {subjects.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("title")} description={isSupabaseConfigured ? t("noQuestions") : t("notConfigured")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {subjects.map((subject) => (
            <li key={subject.code}>
              <Link
                href={`/practice/${subject.code}`}
                className="flex h-full items-center gap-4 rounded-2xl bg-card p-5 shadow-soft hover-lift outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <SubjectIcon icon={subject.icon} color={subject.color} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{subject.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {subject.availableQuestions > 0
                      ? t("questionsAvailable", { count: subject.availableQuestions })
                      : t("noQuestions")}
                  </p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FadeIn>
  );
}
