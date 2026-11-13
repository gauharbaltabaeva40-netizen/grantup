import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Check, Lock, Play, Star } from "lucide-react";
import type { CatalogSubject, LessonStatus } from "@/lib/content/catalog";
import { cn } from "@/lib/utils";

// Түйіндердің көлденең ығысуы — ойындағы деңгейлер картасындағыдай «жыланша» жол
const OFFSETS = [0, 44, 64, 44, 0, -44, -64, -44];

const nodeStyles: Record<LessonStatus, string> = {
  completed: "bg-success text-white shadow-[0_6px_0_0_#15803d]",
  current: "bg-brand-gradient text-white shadow-[0_6px_0_0_#0f1f4d] ring-4 ring-primary/25",
  available: "bg-card text-primary border-2 border-primary/40 shadow-[0_6px_0_0_var(--border)]",
  locked: "bg-muted text-muted-foreground shadow-[0_6px_0_0_var(--border)]",
};

const icons: Record<LessonStatus, typeof Check> = { completed: Check, current: Play, available: Star, locked: Lock };

export async function LessonPath({ subject }: { subject: CatalogSubject }) {
  const t = await getTranslations("lessons");
  let index = 0;

  return (
    <div className="space-y-10">
      {subject.topics.map((topic, topicIndex) => (
        <section key={topic.id} aria-labelledby={`topic-${topic.id}`}>
          <div className="mb-6 rounded-2xl bg-card px-4 py-3 shadow-soft">
            <p className="text-xs font-semibold text-muted-foreground uppercase">{topicIndex + 1}</p>
            <h2 id={`topic-${topic.id}`} className="font-bold">
              {topic.title}
            </h2>
          </div>

          <ol className="flex flex-col items-center gap-7">
            {topic.lessons.map((lesson) => {
              const Icon = icons[lesson.status];
              const offset = OFFSETS[index++ % OFFSETS.length];
              return (
                <li key={lesson.id} style={{ transform: `translateX(${offset}px)` }} className="flex flex-col items-center">
                  <Link
                    href={`/lessons/${subject.code}/${lesson.id}`}
                    aria-label={`${lesson.title} — ${t(`status.${lesson.status}`)}`}
                    className="group flex flex-col items-center gap-2 outline-none"
                  >
                    {lesson.status === "current" && (
                      <span className="animate-bounce rounded-xl bg-card px-3 py-1 text-sm font-bold text-primary shadow-soft">
                        {t("start")}
                      </span>
                    )}
                    <span
                      className={cn(
                        "grid size-[72px] place-items-center rounded-full transition-transform group-hover:-translate-y-0.5 group-active:translate-y-1 group-focus-visible:ring-4 group-focus-visible:ring-ring/50",
                        nodeStyles[lesson.status],
                      )}
                    >
                      <Icon className="size-8" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="max-w-[11rem] text-center text-sm leading-tight font-semibold">{lesson.title}</span>
                    {lesson.isFree && lesson.status !== "completed" && (
                      <span className="text-xs font-bold text-success">{t("free")}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
