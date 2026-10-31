import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { ContinueButton } from "@/components/brand/continue-button";
import { EmptyState } from "@/components/brand/empty-state";
import { LessonPath } from "@/components/lessons/lesson-path";
import { SubjectIcon } from "@/components/lessons/subject-icon";
import { FadeIn } from "@/components/motion/fade-in";
import { Progress } from "@/components/ui/progress";
import { BookOpen } from "lucide-react";
import { getCatalog } from "@/lib/content/catalog";

type Params = { params: Promise<{ subject: string }> };

export async function generateMetadata({ params }: Params) {
  const { subject: code } = await params;
  const subject = (await getCatalog(await getLocale())).find((s) => s.code === code);
  return { title: subject?.title };
}

export default async function SubjectPage({ params }: Params) {
  const { subject: code } = await params;
  const [t, tc, locale] = await Promise.all([getTranslations("lessons"), getTranslations("common"), getLocale()]);
  const subject = (await getCatalog(locale)).find((s) => s.code === code);
  if (!subject) notFound();

  const percent = subject.totalLessons ? Math.round((subject.completedLessons / subject.totalLessons) * 100) : 0;

  return (
    <FadeIn className="mx-auto max-w-xl">
      <Link href="/lessons" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("allSubjects")}
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <SubjectIcon icon={subject.icon} color={subject.color} className="size-14" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{subject.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t("progress", { done: subject.completedLessons, total: subject.totalLessons })}
          </p>
          <Progress
            value={percent}
            aria-label={subject.title}
            className="mt-2 [&_[data-slot=progress-indicator]]:bg-brand-gradient [&_[data-slot=progress-track]]:h-2"
          />
        </div>
      </div>

      {subject.currentLessonId ? (
        <ContinueButton href={`/lessons/${subject.code}/${subject.currentLessonId}`} className="mb-8">
          {tc("continue")}
        </ContinueButton>
      ) : (
        subject.totalLessons > 0 && <p className="mb-8 rounded-2xl bg-success/12 px-4 py-3 text-center font-semibold text-success">{t("allDone")}</p>
      )}

      {subject.totalLessons === 0 ? <EmptyState icon={BookOpen} title={t("noLessons")} /> : <LessonPath subject={subject} />}
    </FadeIn>
  );
}
