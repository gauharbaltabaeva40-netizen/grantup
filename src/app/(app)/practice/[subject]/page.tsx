import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { SubjectIcon } from "@/components/lessons/subject-icon";
import { FadeIn } from "@/components/motion/fade-in";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { Protected } from "@/components/protection/protection";
import { getPracticeCatalog } from "@/lib/practice/data";

type Params = { params: Promise<{ subject: string }>; searchParams?: Promise<{ topic?: string }> };

export async function generateMetadata({ params }: Params) {
  const { subject: code } = await params;
  const [t, subjects] = await Promise.all([getTranslations("practice"), getPracticeCatalog(await getLocale())]);
  const subject = subjects.find((s) => s.code === code);
  return { title: subject ? `${t("navLabel")}: ${subject.title}` : t("title") };
}

export default async function PracticeSubjectPage({ params, searchParams }: Params) {
  const { subject: code } = await params;
  const { topic } = (await searchParams) ?? {};
  const [t, subjects] = await Promise.all([getTranslations("practice"), getPracticeCatalog(await getLocale())]);
  const subject = subjects.find((s) => s.code === code);
  if (!subject) notFound();

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-5">
      <Link href="/practice" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        {t("backToSubjects")}
      </Link>

      <div className="flex items-center gap-4">
        <SubjectIcon icon={subject.icon} color={subject.color} className="size-14" />
        <div>
          <p className="text-sm font-semibold text-muted-foreground">{t("title")}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">{subject.title}</h1>
        </div>
      </div>

      <Protected>
      <section className="rounded-2xl bg-card p-5 shadow-soft sm:p-6">
        {subject.availableQuestions > 0 ? (
          <PracticeSetup
            subjectCode={subject.code}
            topics={subject.topics}
            initialTopicId={subject.topics.some((tp) => tp.id === topic && !tp.locked) ? topic! : null}
          />
        ) : (
          <p className="text-muted-foreground">{t("noQuestions")}</p>
        )}
      </section>
      </Protected>
    </FadeIn>
  );
}
