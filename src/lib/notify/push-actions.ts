"use server";

import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { createAdminClient } from "@/lib/supabase/admin";

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

/** Браузердің push жазылымын сақтау (бір endpoint — бір жазба; басқа оқушыда болса — қайта байланады). */
export async function savePushSubscription(input: unknown): Promise<{ ok: boolean }> {
  try {
    const user = await requireUser();
    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    if (!(await rateLimit(`push:sub:${user.id}`, 20, 60 * 60))) return { ok: false };

    const { userAgent } = await getRequestInfo();
    const { error } = await createAdminClient()
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
          user_agent: userAgent,
        },
        { onConflict: "endpoint" },
      );
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("savePushSubscription failed", error);
    return { ok: false };
  }
}

export async function deletePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  try {
    const user = await requireUser();
    await createAdminClient().from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
    return { ok: true };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("deletePushSubscription failed", error);
    return { ok: false };
  }
}
