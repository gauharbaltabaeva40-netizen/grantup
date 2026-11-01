"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { almatyToday } from "./xp";

/** Мерекелеу терезесі жабылды — бұл оқиғалар қайта көрсетілмейді. */
export async function markCelebrated() {
  try {
    const user = await requireUser();
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("level").eq("id", user.id).single();
    await Promise.all([
      admin
        .from("profiles")
        .update({ celebrated_level: profile?.level ?? 1, celebrated_streak_date: almatyToday() })
        .eq("id", user.id),
      (await createClient())
        .from("user_achievements")
        .update({ seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("seen_at", null),
    ]);
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("markCelebrated failed", error);
  }
}

/** Streak freeze сатып алу (XP-мен; ең көбі 2). */
export async function buyStreakFreeze(): Promise<{ ok: boolean; error?: "max_reached" | "not_enough_xp" | "unknown" }> {
  try {
    const user = await requireUser();
    if (!(await rateLimit(`freeze:${user.id}`, 10, 60 * 60))) return { ok: false, error: "unknown" };
    const { data, error } = await createAdminClient().rpc("buy_streak_freeze", { p_user: user.id });
    if (error) throw error;
    revalidatePath("/", "layout");
    return data === "ok" ? { ok: true } : { ok: false, error: data as "max_reached" | "not_enough_xp" };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("buyStreakFreeze failed", error);
    return { ok: false, error: "unknown" };
  }
}
