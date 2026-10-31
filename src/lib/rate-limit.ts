import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Postgres-тегі қарапайым rate limit (public.rate_limit_hit).
 * true — рұқсат, false — шектеуден асты. Дерекқор/кілт қатесінде қызметті тоқтатпаймыз (fail-open), бірақ лог жазамыз.
 * Растау кодтарының өз шегі бар (5 әрекет, дерекқорда) — бұл қосымша қабат.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error("rate_limit_hit failed", error);
    return true;
  }
}
