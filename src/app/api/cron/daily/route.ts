import { isAuthorizedCron } from "@/lib/cron";
import { runDailyJobs } from "@/lib/notify/jobs";
import { purgeOldProctoring } from "@/lib/proctoring/server";

/** Күнделікті хабарламалар + ескі прокторинг фотоларын өшіру. Vercel Cron: 20:00 Asia/Almaty (= 15:00 UTC), vercel.json-да. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("unauthorized", { status: 401 });
  try {
    const sent = await runDailyJobs();
    // Хабарламалар сәтсіз болса да тазалау жүрсін (және керісінше)
    const proctoringPurged = await purgeOldProctoring().catch((error) => {
      console.error("proctoring purge failed", error);
      return -1;
    });
    return Response.json({ ok: true, sent, proctoringPurged });
  } catch (error) {
    console.error("daily cron failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
