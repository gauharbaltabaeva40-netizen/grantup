import "server-only";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { getAccessibleTopicIds, getCatalog } from "@/lib/content/catalog";
import { asLocale } from "@/lib/content/localize";
import { createAdminClient } from "@/lib/supabase/admin";

export type PracticeTopic = { id: string; title: string; questionCount: number; locked: boolean };
export type PracticeSubject = {
  code: string;
  title: string;
  icon: string | null;
  color: string | null;
  topics: PracticeTopic[];
  availableQuestions: number;
};

/**
 * Жаттығу үшін пәндер мен тақырыптар және әр тақырыптағы сұрақ саны (оқушы тілінде; болмаса — барлық тілде).
 * Сұрақ мазмұны емес, тек саны — service_role арқылы.
 */
export const getPracticeCatalog = cache(async (locale: string): Promise<PracticeSubject[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const [catalog, accessible, { data: questions }] = await Promise.all([
    getCatalog(locale),
    getAccessibleTopicIds(locale),
    createAdminClient().from("questions").select("topic_id, locale").eq("is_active", true).not("topic_id", "is", null),
  ]);

  const counts = new Map<string, { own: number; all: number }>();
  for (const q of questions ?? []) {
    const c = counts.get(q.topic_id!) ?? { own: 0, all: 0 };
    c.all++;
    if (q.locale === asLocale(locale)) c.own++;
    counts.set(q.topic_id!, c);
  }

  return catalog.map((subject) => {
    const topics = subject.topics.map((t) => {
      const c = counts.get(t.id);
      return { id: t.id, title: t.title, questionCount: c ? c.own || c.all : 0, locked: !accessible.has(t.id) };
    });
    return {
      code: subject.code,
      title: subject.title,
      icon: subject.icon,
      color: subject.color,
      topics,
      availableQuestions: topics.filter((t) => !t.locked).reduce((sum, t) => sum + t.questionCount, 0),
    };
  });
});

export type MistakeItem = {
  questionId: string;
  stem: string;
  subjectCode: string;
  subjectTitle: string;
  wrongCount: number;
  lastWrongAt: string;
};

/** «Қателерім»: әлі түзелмеген қателер (жаңалары жоғарыда). Тек ашық тақырыптардағы сұрақтар. */
export const getOpenMistakes = cache(async (locale: string): Promise<MistakeItem[]> => {
  const user = await getSessionUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data: mistakes } = await admin
    .from("user_mistakes")
    .select("question_id, wrong_count, last_wrong_at")
    .eq("user_id", user.id)
    .is("resolved_at", null)
    .order("last_wrong_at", { ascending: false })
    .limit(200);
  if (!mistakes?.length) return [];

  const [{ data: questions }, catalog, accessible] = await Promise.all([
    admin.from("questions").select("id, stem, topic_id, subject_id, is_active").in("id", mistakes.map((m) => m.question_id)),
    getCatalog(locale),
    getAccessibleTopicIds(locale),
  ]);

  const byId = new Map((questions ?? []).map((q) => [q.id, q]));
  return mistakes.flatMap((m) => {
    const q = byId.get(m.question_id);
    if (!q?.is_active || !q.topic_id || !accessible.has(q.topic_id)) return [];
    const subject = catalog.find((s) => s.id === q.subject_id);
    return [
      {
        questionId: q.id,
        stem: q.stem,
        subjectCode: subject?.code ?? "",
        subjectTitle: subject?.title ?? "",
        wrongCount: m.wrong_count,
        lastWrongAt: m.last_wrong_at,
      },
    ];
  });
});
