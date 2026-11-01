"use server";

import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { logSecurityEvent } from "./events";

/** Клиенттен келетін қорғау оқиғалары (скриншот пернесі, басып шығару, DevTools, көшіру). */
const CLIENT_EVENTS = ["screenshot_key", "print_attempt", "devtools_open", "copy_attempt", "save_attempt"] as const;

const schema = z.object({
  type: z.enum(CLIENT_EVENTS),
  path: z.string().max(200),
  detail: z.string().max(100).optional(),
});

/**
 * Қорғау оқиғасын журналға жазу. Әр түрі бір оқушыдан 10 минутта ең көбі 5 рет —
 * журнал толып кетпеуі үшін (админ бәрібір қайталанғанын көреді).
 */
export async function reportSecurityEvent(input: z.infer<typeof schema>): Promise<void> {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return;
    if (!(await rateLimit(`sec:${parsed.data.type}:${user.id}`, 5, 10 * 60))) return;

    await logSecurityEvent({
      userId: user.id,
      type: parsed.data.type,
      severity: parsed.data.type === "devtools_open" || parsed.data.type === "screenshot_key" ? "warning" : "info",
      info: await getRequestInfo(),
      meta: { path: parsed.data.path, detail: parsed.data.detail ?? null },
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("reportSecurityEvent failed", error);
  }
}
