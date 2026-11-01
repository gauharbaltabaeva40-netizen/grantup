import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight, CircleCheck, FileText, ListChecks, Lock, PlayCircle, VideoOff } from "lucide-react";
import { GradientCard } from "@/components/brand/gradient-card";
import { Markdown } from "@/components/content/markdown";
import { CompleteLessonButton } from "@/components/lessons/complete-lesson-button";
import { VideoPlayer } from "@/components/lessons/video-player";
import { FadeIn } from "@/components/motion/fade-in";
import { Protected } from "@/components/protection/protection";
import { LessonQuiz } from "@/components/quiz/lesson-quiz";
import { buttonVariants } from "@/components/ui/button";
import { getLessonDetail } from "@/lib/content/catalog";
import { getSetting } from "@/lib/settings";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ subject: string; lessonId: string }> };

export async function generateMetadata({ params }: Params) {
  const { subject, lessonId } = await params;
  const detail = await getLessonDetail(subject, lessonId, await getLocale());
  return { title: detail?.lesson.title };
}

function Section({ icon: Icon, title, children }: { icon: typeof FileText; title: string; children: React.ReactNode }) {
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

export default async function LessonPage({ params }: Params) {
  const { subject: subjectCode, lessonId } = await params;
  const locale = await getLocale();
  const [t, tl, detail, xp] = await Promise.all([
    getTranslations("lessons"),
    getTranslations("lessons.lesson"),
    getLessonDetail(subjectCode, lessonId, locale),
    getSetting("xp"),
  ]);
  if (!detail) notFound();

  const { subject, topic, lesson, nextLesson } = detail;
  const nextHref = nextLesson ? `/lessons/${subject.code}/${nextLesson.id}` : null;
  const completed = lesson.status === "completed";

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/lessons/${subject.code}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {subject.title}
      </Link>

      <div>
        <p className="text-sm font-semibold text-muted-foreground">{topic.title}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight sm:text-3xl">{lesson.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          {completed && (
            <span className="flex items-center gap-1 font-semibold text-success">
              <CircleCheck className="size-4" aria-hidden />
              {tl("completed")}
            </span>
          )}
          {lesson.durationSeconds ? (
            <span className="text-muted-foreground">{t("minutes", { count: Math.round(lesson.durationSeconds / 60) })}</span>
          ) : null}
          <span className="font-bold text-primary">{tl("xpReward", { xp: lesson.xpReward })}</span>
        </div>
      </div>

      {lesson.status === "locked" ? (
        <GradientCard className="text-center">
          <Lock className="mx-auto mb-3 size-10" aria-hidden />
          <h2 className="text-xl font-extrabold">{tl("lockedTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-white/85">{tl("lockedText")}</p>
          <Link href="/upgrade" className={cn(buttonVariants({ variant: "white", size: "2xl" }), "mt-5")}>
            {tl("toUpgrade")}
            <ArrowRight aria-hidden />
          </Link>
        </GradientCard>
      ) : (
        <Protected className="space-y-5">
          <section aria-label={tl("video")}>
            {detail.hasVideo ? (
              <VideoPlayer lessonId={lesson.id} startSeconds={detail.videoCompleted ? 0 : detail.videoPositionSeconds} />
            ) : (
              <div className="grid aspect-video place-items-center rounded-2xl bg-muted p-6 text-center text-muted-foreground">
                <div>
                  <VideoOff className="mx-auto mb-2 size-8" aria-hidden />
                  <p className="text-sm font-medium">{tl("noVideo")}</p>
                </div>
              </div>
            )}
          </section>

          <Section icon={FileText} title={tl("summary")}>
            {detail.summary ? <Markdown>{detail.summary}</Markdown> : <p className="text-muted-foreground">{tl("noSummary")}</p>}
          </Section>

          {detail.quizQuestionCount > 0 ? (
            <Section icon={ListChecks} title={tl("quiz")}>
              <LessonQuiz
                lessonId={lesson.id}
                questionCount={detail.quizQuestionCount}
                passPercent={xp.quizPassPercent}
                bestPercent={detail.quizBestPercent}
                nextHref={nextHref}
              />
            </Section>
          ) : (
            !completed && (
              <Section icon={PlayCircle} title={tl("complete")}>
                <CompleteLessonButton lessonId={lesson.id} />
              </Section>
            )
          )}

          {nextHref && (completed || detail.quizQuestionCount === 0) && (
            <Link href={nextHref} className={cn(buttonVariants({ variant: completed ? "brand" : "outline", size: "2xl" }), "w-full")}>
              {tl("next")}: {nextLesson!.title}
              <ArrowRight aria-hidden />
            </Link>
          )}
        </Protected>
      )}
    </FadeIn>
  );
}
