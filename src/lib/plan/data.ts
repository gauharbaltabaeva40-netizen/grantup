import "server-only";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { almatyToday } from "@/lib/gamification/xp";
import { createClient } from "@/lib/supabase/server";
import type { StudyPlanData } from "./types";

export const getActivePlan = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("study_plans")
    .select("id, plan, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const plan = data.plan as unknown as StudyPlanData;
  const today = almatyToday();
  return { ...plan, createdAt: data.created_at, today, todayItems: plan.days.find((d) => d.date === today)?.items ?? [] };
});

/** Бүгінгі жоспар: әр тапсырманың орындалғаны (сабақ аяқталды / бүгін жаттығу, қателер, сынақ тапсырылды). */
export const getTodayPlan = cache(async () => {
  const plan = await getActivePlan();
  const user = await getSessionUser();
  if (!plan || !user) return null;

  const items = plan.todayItems;
  const supabase = await createClient();
  const startOfDay = new Date(`${plan.today}T00:00:00+05:00`).toISOString();
  const lessonIds = items.filter((i) => i.lessonId).map((i) => i.lessonId!);

  const [{ data: lessons }, { data: attempts }] = await Promise.all([
    lessonIds.length
      ? supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id).in("lesson_id", lessonIds).not("completed_at", "is", null)
      : Promise.resolve({ data: [] as { lesson_id: string }[] }),
    supabase
      .from("attempts")
      .select("kind, topic_id")
      .eq("user_id", user.id)
      .in("status", ["finished", "expired"])
      .gte("finished_at", startOfDay),
  ]);

  const completedLessons = new Set((lessons ?? []).map((l) => l.lesson_id));
  const doneFlags = items.map((item) => {
    switch (item.type) {
      case "lesson":
        return Boolean(item.lessonId && completedLessons.has(item.lessonId));
      case "practice":
        return (attempts ?? []).some((a) => a.kind === "practice" && (!item.topicId || !a.topic_id || a.topic_id === item.topicId));
      case "mistakes":
        return (attempts ?? []).some((a) => a.kind === "mistakes");
      case "mock":
        return (attempts ?? []).some((a) => a.kind === "mock");
    }
  });

  return {
    items: items.map((item, i) => ({ ...item, done: doneFlags[i] })),
    lessons: items.filter((i) => i.type === "lesson").length,
    questions: items.reduce((sum, i) => sum + (i.type === "practice" || i.type === "mistakes" ? (i.questions ?? 0) : 0), 0),
    done: doneFlags.filter(Boolean).length,
    total: items.length,
  };
});
