import { isAuthorizedCron } from "@/lib/cron";
import { runWeeklyJobs } from "@/lib/notify/jobs";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300;

/**
 * Апталық лига қорытындысы + апта хабарламалары (push, email). Vercel Cron: дүйсенбі 00:00 Asia/Almaty (= жексенбі 19:00 UTC), vercel.json-да.
 * Өткен апталардың жабылмаған барлық топтарын жабады (cron бір рет өткізіп алса да, келесі жолы түзеледі).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: currentWeek } = await admin.rpc("league_week_start", {});
  const { data: open } = await admin
    .from("league_groups")
    .select("week_start")
    .is("closed_at", null)
    .lt("week_start", currentWeek as unknown as string);

  const weeks = [...new Set((open ?? []).map((g) => g.week_start))].sort();
  let closed = 0;
  for (const week of weeks) {
    const { data, error } = await admin.rpc("close_league_week", { p_week: week });
    if (error) {
      console.error("close_league_week failed", week, error);
      return Response.json({ ok: false, week, closed }, { status: 500 });
    }
    closed += data ?? 0;
  }
  // Жабылған апталар бойынша қорытынды хабарламалары (бұрын жіберілгендері қайталанбайды)
  const sent: Record<string, Record<string, number>> = {};
  for (const week of weeks) sent[week] = await runWeeklyJobs(week);
  return Response.json({ ok: true, weeks, closed, sent });
}
