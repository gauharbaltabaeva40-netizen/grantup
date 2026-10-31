import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type XpAward = { awarded: boolean; xp: number; level: number; levelUp: boolean };

/**
 * XP беру (public.award_xp — атомарлы, бір себеп+объект үшін бір рет).
 * 8-кезеңде streak пен апталық лига XP-і осы жерде жаңартылады.
 */
export async function awardXp(userId: string, amount: number, reason: string, ref: string): Promise<XpAward | null> {
  if (amount <= 0) return null;
  const { data, error } = await createAdminClient().rpc("award_xp", {
    p_user: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref: ref,
  });
  if (error || !data?.[0]) {
    console.error("award_xp failed", error);
    return null;
  }
  const row = data[0];
  return { awarded: row.awarded, xp: row.xp, level: row.level, levelUp: row.level_up };
}

/** Asia/Almaty бойынша бүгінгі күн (YYYY-MM-DD) */
export function almatyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
}
