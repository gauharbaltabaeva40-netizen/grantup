import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BookOpen, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { SubjectIcon } from "@/components/lessons/subject-icon";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getCatalog } from "@/lib/content/catalog";
import { isSupabaseConfigured } from "@/lib/env";

export async function generateMetadata() {
  const t = await getTranslations("lessons");
  return { title: t("title") };
}

export default async function LessonsPage() {
  const [t, locale] = await Promise.all([getTranslations("lessons"), getLocale()]);
  const catalog = await getCatalog(locale);

  return (
    <FadeIn>
      <PageHeader title={t("title")} description={t("description")} />

      {catalog.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("emptyTitle")}
          description={isSupabaseConfigured ? t("emptyText") : t("notConfigured")}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {catalog.map((subject) => {
            const percent = subject.totalLessons ? Math.round((subject.completedLessons / subject.totalLessons) * 100) : 0;
            return (
              <li key={subject.code}>
                <Link
                  href={`/lessons/${subject.code}`}
                  className="group flex h-full flex-col gap-4 rounded-2xl bg-card p-5 shadow-soft transition-shadow outline-none hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex items-start gap-4">
                    <SubjectIcon icon={subject.icon} color={subject.color} />
                    <div className="min-w-0 flex-1">
                      <Badge variant="secondary" className="mb-1.5">
                        {t(`kind.${subject.kind}`)}
                      </Badge>
                      <h2 className="text-lg leading-snug font-bold">{subject.title}</h2>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <div className="mt-auto">
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {t("progress", { done: subject.completedLessons, total: subject.totalLessons })}
                      </span>
                      <span className="font-bold tabular-nums">{percent}%</span>
                    </div>
                    <Progress
                      value={percent}
                      aria-label={subject.title}
                      className="[&_[data-slot=progress-indicator]]:bg-brand-gradient [&_[data-slot=progress-track]]:h-2"
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </FadeIn>
  );
}
