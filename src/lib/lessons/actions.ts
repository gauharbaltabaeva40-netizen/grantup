"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth/session";
import { countQuizQuestions } from "@/lib/content/catalog";
import { awardXp } from "@/lib/gamification/xp";
import { rateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function canAccessLesson(lessonId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_access_lesson", { p_lesson: lessonId });
  return data === true;
}

/**
 * Видео ID-ін беру. ID HTML-ге/бетке салынбайды: ойнатқыш жүктелгенде ғана, доступ тексерілгеннен кейін сұралады.
 * ЕСКЕРТУ: браузер iframe-ге ID-ді бәрібір береді — бұл таратуды қиындатады, бірақ 100% жасыра алмайды.
 * Сондықтан видео YouTube-та unlisted болуы және су таңбасы (11-кезең) қосымша қорғаныс болып табылады.
 */
export async function getLessonVideo(lessonId: string): Promise<{ ok: true; videoId: string } | { ok: false }> {
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(lessonId).success) return { ok: false };
    if (!(await rateLimit(`video:${user.id}`, 60, 10 * 60))) return { ok: false };
    if (!(await canAccessLesson(lessonId))) return { ok: false };

    const { data } = await createAdminClient().from("lesson_videos").select("youtube_id").eq("lesson_id", lessonId).maybeSingle();
    return data ? { ok: true, videoId: data.youtube_id } : { ok: false };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("getLessonVideo failed", error);
    return { ok: false };
  }
}

/** Видеоның қай жеріне дейін көрілгенін сақтау (ойнатқыш ~15 секунд сайын және тоқтағанда шақырады). */
export async function saveVideoProgress(lessonId: string, positionSeconds: number, durationSeconds: number) {
  try {
    const user = await requireUser();
    const parsed = z
      .object({ lessonId: z.uuid(), position: z.number().min(0).max(86_400), duration: z.number().min(0).max(86_400) })
      .safeParse({ lessonId, position: positionSeconds, duration: durationSeconds });
    if (!parsed.success) return;
    if (!(await rateLimit(`video:progress:${user.id}`, 120, 10 * 60))) return;
    if (!(await canAccessLesson(lessonId))) return;

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("lesson_progress")
      .select("video_completed")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    const { position, duration } = parsed.data;
    await admin.from("lesson_progress").upsert({
      user_id: user.id,
      lesson_id: lessonId,
      video_position_seconds: Math.floor(position),
      video_completed: existing?.video_completed || (duration > 0 && position >= duration * 0.9),
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("saveVideoProgress failed", error);
  }
}

/** Тесті жоқ сабақты аяқтау (тесті бар сабақ тек тесттен өткенде аяқталады). */
export async function completeLesson(lessonId: string): Promise<{ ok: boolean; xp: number; levelUp: boolean; level: number | null }> {
  const none = { ok: false, xp: 0, levelUp: false, level: null };
  try {
    const user = await requireUser();
    if (!z.uuid().safeParse(lessonId).success) return none;
    if (!(await canAccessLesson(lessonId))) return none;

    const admin = createAdminClient();
    const { data: lesson } = await admin.from("lessons").select("topic_id, xp_reward").eq("id", lessonId).single();
    if (!lesson) return none;
    if ((await countQuizQuestions(lesson.topic_id, "kk")) > 0) return none;

    const { data: progress } = await admin
      .from("lesson_progress")
      .select("completed_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    if (!progress?.completed_at) {
      await admin.from("lesson_progress").upsert({ user_id: user.id, lesson_id: lessonId, completed_at: new Date().toISOString() });
    }

    const xp = await getSetting("xp");
    const award = await awardXp(user.id, lesson.xp_reward || xp.lessonComplete, "lesson_complete", lessonId);
    revalidatePath("/lessons", "layout");
    return {
      ok: true,
      xp: award?.awarded ? lesson.xp_reward || xp.lessonComplete : 0,
      levelUp: award?.levelUp ?? false,
      level: award?.level ?? null,
    };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("completeLesson failed", error);
    return none;
  }
}
