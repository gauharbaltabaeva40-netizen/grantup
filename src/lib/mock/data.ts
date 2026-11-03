import "server-only";
import { cache } from "react";
import { getAccess } from "@/lib/access";
import { getSessionUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/content/catalog";
import { localized } from "@/lib/content/localize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { expireOverdueMocks, finalizeMock, isPastDeadline, structureOf } from "./server";
import type { MockAnswerState, MockState } from "./types";

export type MockListItem = {
  id: string;
  title: string;
  isFree: boolean;
  locked: boolean;
  questionCount: number;
};

export type MockHistoryItem = {
  attemptId: string;
  title: string;
  finishedAt: string;
  score: number;
  maxScore: number;
  status: "finished" | "expired";
};

export const getMockOverview = cache(async (locale: string) => {
  const user = await getSessionUser();
  if (!user) return null;

  await expireOverdueMocks(user.id);

  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: exams }, access, { data: attempts }] = await Promise.all([
    supabase.from("mock_exams").select("id, title_kk, title_ru, is_free, locale").eq("is_published", true).order("created_at"),
    getAccess(),
    supabase
      .from("attempts")
      .select("id, mock_exam_id, status, finished_at, score, max_score")
      .eq("user_id", user.id)
      .eq("kind", "mock")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const { data: counts } = exams?.length
    ? await admin.from("mock_exam_questions").select("mock_exam_id").in("mock_exam_id", exams.map((e) => e.id))
    : { data: [] };

  const titleOf = new Map((exams ?? []).map((e) => [e.id, localized(e, "title", locale)]));
  const items: MockListItem[] = (exams ?? []).map((e) => ({
    id: e.id,
    title: localized(e, "title", locale),
    isFree: e.is_free,
    locked: !e.is_free && access.tier !== "full",
    questionCount: (counts ?? []).filter((c) => c.mock_exam_id === e.id).length,
  }));

  const active = (attempts ?? []).find((a) => a.status === "in_progress");
  const history: MockHistoryItem[] = (attempts ?? [])
    .filter((a) => (a.status === "finished" || a.status === "expired") && a.finished_at)
    .map((a) => ({
      attemptId: a.id,
      title: titleOf.get(a.mock_exam_id ?? "") ?? "—",
      finishedAt: a.finished_at!,
      score: Number(a.score ?? 0),
      maxScore: Number(a.max_score ?? 0),
      status: a.status as "finished" | "expired",
    }));

  return { items, history, activeAttemptId: active?.id ?? null };
});

/** Сынақ экранының бастапқы күйі. Мерзімі өтсе — аяқтап, null қайтарады (нәтиже бетіне бағыттаймыз). */
export async function getMockState(attemptId: string, locale: string): Promise<MockState | "finished" | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .eq("kind", "mock")
    .maybeSingle();
  if (!attempt) return null;
  if (attempt.status !== "in_progress") return "finished";
  if (isPastDeadline(attempt)) {
    await finalizeMock(attempt, "expired");
    return "finished";
  }

  const [{ data: answers }, { data: exam }, catalog, { data: profile }] = await Promise.all([
    admin
      .from("attempt_answers")
      .select("question_id, selected_option_ids, flagged, time_spent_ms")
      .eq("attempt_id", attempt.id),
    admin.from("mock_exams").select("title_kk, title_ru").eq("id", attempt.mock_exam_id!).single(),
    getCatalog(locale),
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  const answerMap: Record<string, MockAnswerState> = {};
  for (const a of answers ?? []) {
    answerMap[a.question_id] = { selected: a.selected_option_ids, flagged: a.flagged, timeSpentMs: a.time_spent_ms };
  }

  return {
    attemptId: attempt.id,
    title: exam ? localized(exam, "title", locale) : "",
    studentName: profile?.full_name ?? "",
    deadlineAt: attempt.deadline_at!,
    serverNow: new Date().toISOString(),
    questionIds: attempt.question_ids,
    sections: structureOf(attempt).layout.map((s) => ({
      ...s,
      title: catalog.find((c) => c.code === s.subject)?.title ?? s.subject,
    })),
    answers: answerMap,
  };
}

// ---------------------------------------------------------------------
// Аналитика
// ---------------------------------------------------------------------

export type MockAnalytics = {
  attemptId: string;
  title: string;
  finishedAt: string;
  status: "finished" | "expired";
  score: number;
  maxScore: number;
  /** ҰБТ-ның ресми ең жоғары балы (конфигтен) — демо вариантта maxScore одан аз болуы мүмкін */
  officialMax: number;
  totalQuestions: number;
  sections: { code: string; title: string; score: number; max: number; correct: number; total: number; seconds: number }[];
  topics: { subjectCode: string; topicId: string; title: string; correct: number; total: number; percent: number }[];
  weakTopics: { topicId: string; title: string; subjectTitle: string; percent: number; lessonHref: string | null }[];
  history: { attemptId: string; finishedAt: string; score: number; maxScore: number; current: boolean }[];
};

export const getMockAnalytics = cache(async (attemptId: string, locale: string): Promise<MockAnalytics | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .eq("kind", "mock")
    .maybeSingle();
  if (!attempt || attempt.status === "in_progress" || attempt.status === "abandoned") return null;

  const [{ data: answers }, { data: questions }, { data: exam }, { data: previous }, catalog] = await Promise.all([
    admin.from("attempt_answers").select("question_id, is_correct").eq("attempt_id", attempt.id),
    admin.from("questions").select("id, topic_id").in("id", attempt.question_ids),
    admin.from("mock_exams").select("title_kk, title_ru").eq("id", attempt.mock_exam_id!).single(),
    admin
      .from("attempts")
      .select("id, finished_at, score, max_score")
      .eq("user_id", user.id)
      .eq("kind", "mock")
      .in("status", ["finished", "expired"])
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: true })
      .limit(20),
    getCatalog(locale),
  ]);

  const structure = structureOf(attempt);
  const sectionScores = (attempt.section_scores ?? {}) as Record<string, { score: number; max: number; correct: number; total: number }>;
  const time = (attempt.time_by_subject ?? {}) as Record<string, number>;

  const sections = structure.layout.map((s) => {
    const sc = sectionScores[s.subject] ?? { score: 0, max: 0, correct: 0, total: 0 };
    return {
      code: s.subject,
      title: catalog.find((c) => c.code === s.subject)?.title ?? s.subject,
      ...sc,
      seconds: time[s.subject] ?? 0,
    };
  });

  // Тақырыптар бойынша дұрыс жауап пайызы
  const correctById = new Map((answers ?? []).map((a) => [a.question_id, Boolean(a.is_correct)]));
  const topicStats = new Map<string, { correct: number; total: number }>();
  for (const q of questions ?? []) {
    if (!q.topic_id) continue;
    const s = topicStats.get(q.topic_id) ?? { correct: 0, total: 0 };
    s.total++;
    if (correctById.get(q.id)) s.correct++;
    topicStats.set(q.topic_id, s);
  }

  const topics: MockAnalytics["topics"] = [];
  const weakCandidates: (MockAnalytics["weakTopics"][number] & { total: number })[] = [];
  for (const subject of catalog) {
    for (const topic of subject.topics) {
      const s = topicStats.get(topic.id);
      if (!s) continue;
      const percent = Math.round((s.correct / s.total) * 100);
      topics.push({ subjectCode: subject.code, topicId: topic.id, title: topic.title, ...s, percent });
      const lesson = topic.lessons.find((l) => l.status !== "locked") ?? topic.lessons[0];
      weakCandidates.push({
        topicId: topic.id,
        title: topic.title,
        subjectTitle: subject.title,
        percent,
        total: s.total,
        lessonHref: lesson ? `/lessons/${subject.code}/${lesson.id}` : null,
      });
    }
  }
  const weakTopics = weakCandidates
    .filter((t) => t.percent < 100)
    .sort((a, b) => a.percent - b.percent || b.total - a.total)
    .slice(0, 5)
    .map((t) => ({ topicId: t.topicId, title: t.title, subjectTitle: t.subjectTitle, percent: t.percent, lessonHref: t.lessonHref }));

  return {
    attemptId: attempt.id,
    title: exam ? localized(exam, "title", locale) : "",
    finishedAt: attempt.finished_at!,
    status: attempt.status as "finished" | "expired",
    score: Number(attempt.score ?? 0),
    maxScore: Number(attempt.max_score ?? 0),
    officialMax: structure.maxScore,
    totalQuestions: attempt.question_ids.length,
    sections,
    topics,
    weakTopics,
    history: (previous ?? []).map((p) => ({
      attemptId: p.id,
      finishedAt: p.finished_at!,
      score: Number(p.score ?? 0),
      maxScore: Number(p.max_score ?? 0),
      current: p.id === attempt.id,
    })),
  };
});

export type MockReviewState = {
  attemptId: string;
  title: string;
  sections: MockState["sections"];
  questionIds: string[];
  statuses: Record<string, "correct" | "wrong" | "empty">;
};

/** Шолу режимінің бастапқы күйі: әр сұрақтың нәтижесі (дұрыс / қате / жауапсыз). */
export async function getMockReviewState(attemptId: string, locale: string): Promise<MockReviewState | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .eq("kind", "mock")
    .in("status", ["finished", "expired"])
    .maybeSingle();
  if (!attempt) return null;

  const [{ data: answers }, { data: exam }, catalog] = await Promise.all([
    admin.from("attempt_answers").select("question_id, selected_option_ids, is_correct").eq("attempt_id", attempt.id),
    admin.from("mock_exams").select("title_kk, title_ru").eq("id", attempt.mock_exam_id!).single(),
    getCatalog(locale),
  ]);

  const statuses: MockReviewState["statuses"] = {};
  for (const id of attempt.question_ids) statuses[id] = "empty";
  for (const a of answers ?? []) {
    statuses[a.question_id] = !a.selected_option_ids.length ? "empty" : a.is_correct ? "correct" : "wrong";
  }

  return {
    attemptId: attempt.id,
    title: exam ? localized(exam, "title", locale) : "",
    questionIds: attempt.question_ids,
    sections: structureOf(attempt).layout.map((s) => ({ ...s, title: catalog.find((c) => c.code === s.subject)?.title ?? s.subject })),
    statuses,
  };
}
