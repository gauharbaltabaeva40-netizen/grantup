import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { FALLBACK, getAnthropic } from "@/lib/ai/client";
import { planSystemPrompt } from "@/lib/ai/prompts";
import { almatyToday } from "@/lib/gamification/xp";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanDay, PlanItem, StudyPlanData } from "./types";

/**
 * Жеке апталық оқу жоспары.
 * Деректер: соңғы 60 күндегі жауаптар (диагностика, сынақ, жаттығу) → тақырыптар бойынша дәлдік,
 * мақсатты балл, ашық әрі аяқталмаған сабақтар. ANTHROPIC_API_KEY болса — Claude құрады
 * (құрылымдалған JSON, ID-лер тексеріледі), болмаса не қате болса — ережелер бойынша.
 * Сессияға (cookie) тәуелді емес — after() ішінде де шақыруға болады.
 */

type TopicInfo = {
  id: string;
  title: string;
  subjectCode: string;
  subjectTitle: string;
  accuracy: number | null;
  answered: number;
  lessons: { id: string; title: string }[];
};

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function loadContext(userId: string, locale: "kk" | "ru") {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 86400_000).toISOString();

  const [subjects, topics, lessons, progress, answers, fullAccess, mistakes, mocks, profile] = await Promise.all([
    admin.from("subjects").select("id, code, title_kk, title_ru").order("position"),
    admin.from("topics").select("id, subject_id, title_kk, title_ru, position").eq("is_published", true).order("position"),
    admin.from("lessons").select("id, topic_id, title_kk, title_ru, position, is_free").eq("is_published", true).order("position"),
    admin.from("lesson_progress").select("lesson_id").eq("user_id", userId).not("completed_at", "is", null),
    admin.from("attempt_answers").select("question_id, is_correct").eq("user_id", userId).gte("updated_at", since).not("is_correct", "is", null).limit(3000),
    admin.rpc("user_has_full_access", { p_user: userId }),
    admin.from("user_mistakes").select("question_id", { count: "exact", head: true }).eq("user_id", userId).is("resolved_at", null),
    admin.from("mock_exams").select("id, is_free").eq("is_published", true),
    admin.from("profiles").select("target_score").eq("id", userId).single(),
  ]);

  const full = fullAccess.data === true;
  const done = new Set((progress.data ?? []).map((p) => p.lesson_id));
  const questionIds = [...new Set((answers.data ?? []).map((a) => a.question_id))];
  const { data: questionTopics } = questionIds.length
    ? await admin.from("questions").select("id, topic_id").in("id", questionIds)
    : { data: [] };
  const topicOf = new Map((questionTopics ?? []).map((q) => [q.id, q.topic_id]));

  const stats = new Map<string, { correct: number; total: number }>();
  for (const a of answers.data ?? []) {
    const topicId = topicOf.get(a.question_id);
    if (!topicId) continue;
    const s = stats.get(topicId) ?? { correct: 0, total: 0 };
    s.total++;
    if (a.is_correct) s.correct++;
    stats.set(topicId, s);
  }

  const title = (row: { title_kk: string; title_ru: string }) => (locale === "ru" ? row.title_ru || row.title_kk : row.title_kk || row.title_ru);
  const topicInfos: TopicInfo[] = (topics.data ?? []).map((t) => {
    const subject = (subjects.data ?? []).find((s) => s.id === t.subject_id);
    const s = stats.get(t.id);
    return {
      id: t.id,
      title: title(t),
      subjectCode: subject?.code ?? "",
      subjectTitle: subject ? title(subject) : "",
      accuracy: s ? Math.round((s.correct / s.total) * 100) : null,
      answered: s?.total ?? 0,
      lessons: (lessons.data ?? [])
        .filter((l) => l.topic_id === t.id && (l.is_free || full) && !done.has(l.id))
        .map((l) => ({ id: l.id, title: title(l) })),
    };
  });

  return {
    topics: topicInfos,
    targetScore: profile.data?.target_score ?? null,
    openMistakes: mistakes.count ?? 0,
    mockAvailable: (mocks.data ?? []).some((m) => m.is_free || full),
  };
}

type Context = Awaited<ReturnType<typeof loadContext>>;

/** Ережелер бойынша жоспар: ең әлсіз тақырыптар → сабақ + жаттығу; апта соңында сынақ / қателер. */
function rulesPlan(ctx: Context, today: string, locale: "kk" | "ru"): StudyPlanData {
  const ranked = [...ctx.topics]
    .filter((t) => t.lessons.length > 0 || t.answered > 0)
    .sort((a, b) => (a.accuracy ?? 60) - (b.accuracy ?? 60) || b.answered - a.answered);
  const lessonQueue = new Map(ranked.map((t) => [t.id, [...t.lessons]]));
  const L = locale === "ru"
    ? { practice: "Тренировка", mistakes: "Мои ошибки", mock: "Пробное ЕНТ", summary: "План на неделю по вашим слабым темам." }
    : { practice: "Жаттығу", mistakes: "Қателерімді қайта шешу", mock: "Сынақ ҰБТ", summary: "Әлсіз тақырыптарыңызға арналған апталық жоспар." };

  const days: PlanDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const items: PlanItem[] = [];
    if (i === 6 && ctx.mockAvailable) {
      items.push({ type: "mock", title: L.mock, subjectCode: null, topicId: null, lessonId: null, questions: null });
      return { date, items };
    }
    const topic = ranked.length ? ranked[i % ranked.length] : null;
    if (topic) {
      const lesson = lessonQueue.get(topic.id)?.shift();
      if (lesson) items.push({ type: "lesson", title: lesson.title, subjectCode: topic.subjectCode, topicId: topic.id, lessonId: lesson.id, questions: null });
      items.push({ type: "practice", title: `${L.practice}: ${topic.title}`, subjectCode: topic.subjectCode, topicId: topic.id, lessonId: null, questions: 15 });
    }
    if ((i === 3 || !topic) && ctx.openMistakes > 0) {
      items.push({ type: "mistakes", title: L.mistakes, subjectCode: null, topicId: null, lessonId: null, questions: Math.min(ctx.openMistakes, 20) });
    }
    return { date, items };
  });

  return { summary: L.summary, days, generatedBy: "rules" };
}

const aiPlanSchema = z.object({
  summary: z.string(),
  days: z.array(
    z.object({
      date: z.string(),
      items: z.array(
        z.object({
          type: z.enum(["lesson", "practice", "mistakes", "mock"]),
          title: z.string(),
          topicId: z.string().nullable(),
          lessonId: z.string().nullable(),
          questions: z.number().int().nullable(),
        }),
      ),
    }),
  ),
});

async function aiPlan(ctx: Context, today: string, locale: "kk" | "ru"): Promise<StudyPlanData | null> {
  const anthropic = getAnthropic();
  if (!anthropic) return null;
  const limits = await getSetting("ai_limits");

  const input = {
    dates: Array.from({ length: 7 }, (_, i) => addDays(today, i)),
    targetScore: ctx.targetScore,
    openMistakes: ctx.openMistakes,
    mockAvailable: ctx.mockAvailable,
    topics: ctx.topics.map((t) => ({
      topicId: t.id,
      subject: t.subjectTitle,
      topic: t.title,
      accuracyPercent: t.accuracy,
      answered: t.answered,
      openLessons: t.lessons.map((l) => ({ lessonId: l.id, title: l.title })),
    })),
  };

  try {
    const response = await anthropic.beta.messages.parse({
      model: limits.model,
      max_tokens: 16000,
      ...FALLBACK,
      betas: [...FALLBACK.betas],
      output_config: { effort: "medium", format: betaZodOutputFormat(aiPlanSchema) },
      system: planSystemPrompt(locale),
      messages: [{ role: "user", content: `<student_data>\n${JSON.stringify(input)}\n</student_data>` }],
    });
    if (response.stop_reason !== "end_turn" || !response.parsed_output) return null;

    // Тек нақты бар ID-лерді қалдырамыз
    const topicById = new Map(ctx.topics.map((t) => [t.id, t]));
    const lessonTopic = new Map(ctx.topics.flatMap((t) => t.lessons.map((l) => [l.id, t] as const)));
    const days: PlanDay[] = input.dates.map((date) => {
      const day = response.parsed_output!.days.find((d) => d.date === date);
      const items = (day?.items ?? []).flatMap((item): PlanItem[] => {
        if (item.type === "lesson") {
          const topic = item.lessonId ? lessonTopic.get(item.lessonId) : undefined;
          return topic ? [{ ...item, topicId: topic.id, subjectCode: topic.subjectCode, questions: null }] : [];
        }
        if (item.type === "practice") {
          const topic = item.topicId ? topicById.get(item.topicId) : undefined;
          return topic ? [{ ...item, subjectCode: topic.subjectCode, lessonId: null, questions: Math.min(Math.max(item.questions ?? 15, 10), 30) }] : [];
        }
        if (item.type === "mock" && !ctx.mockAvailable) return [];
        return [{ ...item, subjectCode: null, topicId: null, lessonId: null }];
      });
      return { date, items: items.slice(0, 4) };
    });
    if (days.every((d) => d.items.length === 0)) return null;
    return { summary: response.parsed_output.summary, days, generatedBy: "ai" };
  } catch (error) {
    console.error("AI plan failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
    return null;
  }
}

/**
 * Жоспар құрып сақтау. Апталық лимит (ai_limits.planRegenerationsPerWeek) асса — жаңа жоспар жасалмайды
 * (белсенді жоспары жоқ оқушыға ережелер бойынша бәрібір жасалады).
 */
export async function generateStudyPlan(
  userId: string,
  source: "diagnostic" | "mock" | "manual" | "weekly",
  sourceAttemptId: string | null = null,
): Promise<StudyPlanData | null> {
  const admin = createAdminClient();
  const [{ data: profile }, limits, { count: recent }, { data: active }] = await Promise.all([
    admin.from("profiles").select("locale").eq("id", userId).single(),
    getSetting("ai_limits"),
    admin
      .from("study_plans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
    admin.from("study_plans").select("id").eq("user_id", userId).eq("is_active", true).maybeSingle(),
  ]);

  const overLimit = (recent ?? 0) >= limits.planRegenerationsPerWeek;
  if (overLimit && active) return null;

  const locale = profile?.locale === "ru" ? "ru" : "kk";
  const today = almatyToday();
  const ctx = await loadContext(userId, locale);
  const plan = (!overLimit && (await aiPlan(ctx, today, locale))) || rulesPlan(ctx, today, locale);

  await admin.from("study_plans").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
  const { error } = await admin.from("study_plans").insert({
    user_id: userId,
    source,
    source_attempt_id: sourceAttemptId,
    week_start: today,
    plan,
  });
  if (error) console.error("study plan insert failed", error);
  return plan;
}
