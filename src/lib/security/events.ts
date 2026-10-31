import "server-only";
import type { RequestInfo } from "@/lib/request-info";
import { createAdminClient } from "@/lib/supabase/admin";

type EventInput = {
  userId: string | null;
  type: string;
  severity?: "info" | "warning" | "critical";
  info?: RequestInfo;
  deviceId?: string | null;
  meta?: Record<string, unknown>;
};

export async function logSecurityEvent({ userId, type, severity = "info", info, deviceId, meta }: EventInput) {
  const { error } = await createAdminClient()
    .from("security_events")
    .insert({
      user_id: userId,
      type,
      severity,
      ip: info?.ip ?? null,
      city: info?.city ?? null,
      country: info?.country ?? null,
      user_agent: info?.userAgent ?? null,
      device_id: deviceId ?? null,
      meta: meta ?? {},
    });
  if (error) console.error("security event insert failed", error);
}

const SUSPICIOUS_WINDOW_MINUTES = 60;

/**
 * Кіруді журналға жазып, соңғы 1 сағатта басқа қаладан (қала белгісіз болса — басқа IP-ден)
 * кіру болған-болмағанын тексереді. Болса — админ панельге «күдікті кіру» белгісі түседі.
 */
export async function recordLogin(userId: string, info: RequestInfo) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - SUSPICIOUS_WINDOW_MINUTES * 60_000).toISOString();

  const { data: recent } = await admin
    .from("security_events")
    .select("ip, city")
    .eq("user_id", userId)
    .eq("type", "login")
    .gte("created_at", since)
    .limit(20);

  await logSecurityEvent({ userId, type: "login", info });

  const differs = (recent ?? []).filter((e) =>
    info.city && e.city ? e.city !== info.city : Boolean(info.ip && e.ip && e.ip !== info.ip),
  );
  if (differs.length === 0) return;

  await logSecurityEvent({
    userId,
    type: "suspicious_login",
    severity: "warning",
    info,
    meta: {
      reason: info.city ? "different_city" : "different_ip",
      windowMinutes: SUSPICIOUS_WINDOW_MINUTES,
      previous: differs.slice(0, 5),
    },
  });
}
