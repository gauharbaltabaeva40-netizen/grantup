import "server-only";
import { cache } from "react";
import { getAccess } from "@/lib/access";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { asLocale, localized } from "./localize";

export type LessonStatus = "completed" | "current" | "available" | "locked";

export type CatalogLesson = {
  id: string;
  title: string;
  isFree: boolean;
  status: LessonStatus;
  durationSeconds: number | null;
  xpReward: number;
  topicId: string;
};

export type CatalogTopic = { id: string; title: string; lessons: CatalogLesson[] };

export type CatalogSubject = {
  id: number;
  code: string;
  title: string;
  kind: "mandatory" | "profile";
  icon: string | null;
  color: string | null;
  topics: CatalogTopic[];
  totalLessons: number;
  completedLessons: number;
  /** Келесі ұсынылатын сабақ (жолдағы «ағымдағы») */
  currentLessonId: string | null;
};

/**
 * Сабақтар картасы: пәндер → тақырыптар → сабақтар, оқушы прогресімен.
 * Метадеректер RLS арқылы оқылады (кірген әр оқушыға көрінеді).
 * Құлып тек ақылы контентке қойылады; ашық сабақтарды кез келген ретпен өтуге болады,
 * ал «ағымдағы» — келесі ұсынылатын аяқталмаған сабақ.
 */
export const getCatalog = cache(async (locale: string): Promise<CatalogSubject[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const supabase = await createClient();
  const [{ data: subjects }, { data: topics }, { data: lessons }, { data: progress }, access] = await Promise.all([
    supabase.from("subjects").select("*").order("position"),
    supabase.from("topics").select("*").eq("is_published", true).order("position"),
    supabase.from("lessons").select("*").eq("is_published", true).order("position"),
    supabase.from("lesson_progress").select("lesson_id, completed_at").eq("user_id", user.id),
    getAccess(),
  ]);

  const completed = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
  const full = access.tier === "full";

  return (subjects ?? []).map((subject) => {
    let currentLessonId: string | null = null;
    let total = 0;
    let done = 0;

    const subjectTopics = (topics ?? [])
      .filter((t) => t.subject_id === subject.id)
      .map((topic) => ({
        id: topic.id,
        title: localized(topic, "title", locale),
        lessons: (lessons ?? [])
          .filter((l) => l.topic_id === topic.id)
          .map((lesson): CatalogLesson => {
            total++;
            let status: LessonStatus;
            if (completed.has(lesson.id)) {
              done++;
              status = "completed";
            } else if (!lesson.is_free && !full) {
              status = "locked";
            } else if (!currentLessonId) {
              currentLessonId = lesson.id;
              status = "current";
            } else {
              status = "available";
            }
            return {
              id: lesson.id,
              title: localized(lesson, "title", locale),
              isFree: lesson.is_free,
              status,
              durationSeconds: lesson.duration_seconds,
              xpReward: lesson.xp_reward,
              topicId: topic.id,
            };
          }),
      }));

    return {
      id: subject.id,
      code: subject.code,
      title: localized(subject, "title", locale),
      kind: subject.kind,
      icon: subject.icon,
      color: subject.color,
      topics: subjectTopics,
      totalLessons: total,
      completedLessons: done,
      currentLessonId,
    };
  });
});

export type LessonDetail = {
  subject: CatalogSubject;
  topic: CatalogTopic;
  lesson: CatalogLesson;
  summary: string | null;
  hasVideo: boolean;
  videoPositionSeconds: number;
  videoCompleted: boolean;
  quizBestPercent: number | null;
  quizQuestionCount: number;
  nextLesson: CatalogLesson | null;
};

export const getLessonDetail = cache(
  async (subjectCode: string, lessonId: string, locale: string): Promise<LessonDetail | null> => {
    const catalog = await getCatalog(locale);
    const subject = catalog.find((s) => s.code === subjectCode);
    const topic = subject?.topics.find((t) => t.lessons.some((l) => l.id === lessonId));
    const lesson = topic?.lessons.find((l) => l.id === lessonId);
    if (!subject || !topic || !lesson) return null;

    const ordered = subject.topics.flatMap((t) => t.lessons);
    const nextLesson = ordered[ordered.findIndex((l) => l.id === lessonId) + 1] ?? null;

    if (lesson.status === "locked") {
      return {
        subject, topic, lesson, nextLesson,
        summary: null, hasVideo: false, videoPositionSeconds: 0, videoCompleted: false,
        quizBestPercent: null, quizQuestionCount: 0,
      };
    }

    const user = await getSessionUser();
    const supabase = await createClient();
    const admin = createAdminClient();

    const [{ data: content }, { data: progress }, { count: videoCount }, quizQuestionCount] = await Promise.all([
      // RLS: конспект тек тегін сабақта немесе толық доступта
      supabase.from("lesson_contents").select("summary_kk, summary_ru").eq("lesson_id", lessonId).maybeSingle(),
      supabase.from("lesson_progress").select("*").eq("lesson_id", lessonId).eq("user_id", user!.id).maybeSingle(),
      // Видео ID-ін бетке бермейміз — тек бар-жоғын білеміз
      admin.from("lesson_videos").select("lesson_id", { count: "exact", head: true }).eq("lesson_id", lessonId),
      countQuizQuestions(topic.id, locale),
    ]);

    return {
      subject,
      topic,
      lesson,
      nextLesson,
      summary: content ? localized({ summary_kk: content.summary_kk, summary_ru: content.summary_ru }, "summary", locale) || null : null,
      hasVideo: (videoCount ?? 0) > 0,
      videoPositionSeconds: progress?.video_position_seconds ?? 0,
      videoCompleted: progress?.video_completed ?? false,
      quizBestPercent: progress?.quiz_best_percent ?? null,
      quizQuestionCount,
    };
  },
);

/** Тақырыптағы белсенді сұрақтар саны (оқушы тілінде; болмаса — екінші тілде). Контекстік сұрақтар мәтінімен бірге көрсетіледі. */
export async function countQuizQuestions(topicId: string, locale: string): Promise<number> {
  const admin = createAdminClient();
  const base = () =>
    admin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topicId)
      .eq("is_active", true);
  const { count } = await base().eq("locale", asLocale(locale));
  if (count) return Math.min(count, QUIZ_MAX_QUESTIONS);
  const { count: other } = await base();
  return Math.min(other ?? 0, QUIZ_MAX_QUESTIONS);
}

export const QUIZ_MAX_QUESTIONS = 10;

/**
 * Жаттығуға ашық тақырыптар: толық доступта — бәрі, тегін нұсқада — тегін сабағы бар тақырыптар.
 * (Сұрақтар тақырыпқа байланған, сондықтан ақылы тақырып сұрақтары тегін оқушыға берілмейді.)
 */
export const getAccessibleTopicIds = cache(async (locale: string): Promise<Set<string>> => {
  const [catalog, access] = await Promise.all([getCatalog(locale), getAccess()]);
  const full = access.tier === "full";
  return new Set(
    catalog.flatMap((s) => s.topics).filter((t) => full || t.lessons.some((l) => l.isFree)).map((t) => t.id),
  );
});
