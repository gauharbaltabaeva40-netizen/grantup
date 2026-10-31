import "server-only";
import { cache } from "react";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AccessState = { tier: "free" } | { tier: "full"; endsAt: string };

/**
 * Freemium: толық доступ тек админ берген, мерзімі жүріп тұрған грант болса.
 * Мерзім біткенде оқушы автоматты түрде тегін нұсқаға қайтады (cron қажет емес — уақыт бойынша есептеледі).
 * Контентке қолжетімділік RLS-те де `has_full_access()` арқылы тексеріледі (3-кезең).
 */
export const getAccess = cache(async (): Promise<AccessState> => {
  const user = await getSessionUser();
  if (!user) return { tier: "free" };

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("access_grants")
    .select("ends_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { tier: "full", endsAt: data.ends_at } : { tier: "free" };
});
