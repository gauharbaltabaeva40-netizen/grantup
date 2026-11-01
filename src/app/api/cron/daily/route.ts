import { isAuthorizedCron } from "@/lib/cron";
import { runDailyJobs } from "@/lib/notify/jobs";

/** Күнделікті хабарламалар. Vercel Cron: 20:00 Asia/Almaty (= 15:00 UTC), vercel.json-да. */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("unauthorized", { status: 401 });
  try {
    return Response.json({ ok: true, sent: await runDailyJobs() });
  } catch (error) {
    console.error("daily cron failed", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
