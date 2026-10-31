"use server";

import { z } from "zod";
import { AuthError, getCurrentProfile, requireUser } from "@/lib/auth/session";
import { escapeHtml, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { logSecurityEvent } from "@/lib/security/events";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Device, DeviceRequest } from "@/lib/supabase/types";
import { deviceLabel } from "./label";
import { MAX_CODE_ATTEMPTS, MAX_DEVICES, setDeviceCookie, verifyCode } from "./server";

const identitySchema = z.object({
  deviceKey: z.uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export type DeviceIdentityInput = z.infer<typeof identitySchema>;

export type DeviceStatus =
  | { status: "ok"; deviceKey: string }
  | { status: "pending" | "approved" | "rejected" | "blocked" }
  | { status: "error"; error: "invalid_input" | "rate_limited" | "unauthenticated" | "not_configured" | "unknown" };

export type CodeResult =
  | { ok: true }
  | { ok: false; error: "invalid_code" | "blocked" | "expired" | "no_request" | "rate_limited" | "invalid_input" | "unknown"; attemptsLeft?: number };

const OPEN_STATUSES = ["pending", "approved", "blocked"] as const;

function toErrorStatus(error: unknown): DeviceStatus {
  if (error instanceof AuthError) {
    return { status: "error", error: error.code === "not_configured" ? "not_configured" : "unauthenticated" };
  }
  console.error("device action failed", error);
  return { status: "error", error: "unknown" };
}

async function findOpenRequest(userId: string, deviceKey: string) {
  const { data } = await createAdminClient()
    .from("device_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("device_key", deviceKey)
    .in("status", [...OPEN_STATUSES])
    .maybeSingle();
  return data;
}

function isCodeExpired(request: DeviceRequest) {
  return request.status === "approved" && (!request.code_expires_at || new Date(request.code_expires_at) < new Date());
}

/**
 * Құрылғыны тексеру/тіркеу. /device бетінде, кіргеннен кейін шақырылады.
 * - Таныс құрылғы → cookie береді.
 * - Бос орын бар (< 2) → тіркейді.
 * - Шек толды → админге сұраныс жасайды; оқушы админнен алған кодты енгізуі керек.
 */
export async function registerDevice(input: DeviceIdentityInput): Promise<DeviceStatus> {
  try {
    const user = await requireUser({ device: false });
    const parsed = identitySchema.safeParse(input);
    if (!parsed.success) return { status: "error", error: "invalid_input" };
    const { deviceKey, fingerprint } = parsed.data;

    if (!(await rateLimit(`device:register:${user.id}`, 30, 10 * 60))) {
      return { status: "error", error: "rate_limited" };
    }

    const admin = createAdminClient();
    const info = await getRequestInfo();
    const label = deviceLabel(info.userAgent);
    const seen = {
      label,
      user_agent: info.userAgent,
      last_ip: info.ip,
      last_city: info.city,
      last_country: info.country,
      last_seen_at: new Date().toISOString(),
    };

    const { data: active = [] } = await admin
      .from("devices")
      .select("*")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false });
    const devices = (active ?? []) as Device[];

    // 1. Таныс құрылғы (localStorage ID, немесе ол тазаланса — фингерпринт бойынша)
    const known = devices.find((d) => d.device_key === deviceKey) ?? devices.find((d) => d.fingerprint === fingerprint);
    if (known) {
      await admin.from("devices").update({ ...seen, device_key: deviceKey, fingerprint }).eq("id", known.id);
      await setDeviceCookie(user.id, known.id);
      return { status: "ok", deviceKey };
    }

    // 2. Бос орын бар (админдерге шектеу жоқ)
    const profile = await getCurrentProfile();
    if (devices.length < MAX_DEVICES || profile?.role === "admin") {
      const { data: created, error } = await admin
        .from("devices")
        .insert({ user_id: user.id, device_key: deviceKey, fingerprint, ...seen })
        .select("id")
        .single();
      if (error || !created) throw error ?? new Error("device insert failed");

      await setDeviceCookie(user.id, created.id);
      await logSecurityEvent({ userId: user.id, type: "device_added", info, deviceId: created.id, meta: { label } });
      return { status: "ok", deviceKey };
    }

    // 3. Шек толды → сұраныс
    const open = await findOpenRequest(user.id, deviceKey);
    if (open && isCodeExpired(open)) {
      await admin.from("device_requests").update({ status: "expired" }).eq("id", open.id);
    } else if (open) {
      return { status: open.status as "pending" | "approved" | "blocked" };
    }

    const { data: lastRejected } = await admin
      .from("device_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("device_key", deviceKey)
      .eq("status", "rejected")
      .gte("decided_at", new Date(Date.now() - 24 * 3600_000).toISOString())
      .limit(1)
      .maybeSingle();
    if (lastRejected) return { status: "rejected" };

    const { error: insertError } = await admin.from("device_requests").insert({
      user_id: user.id,
      device_key: deviceKey,
      fingerprint,
      label,
      user_agent: info.userAgent,
      ip: info.ip,
      city: info.city,
      country: info.country,
    });
    // 23505 — параллель сұраныс бұрын жасап қойды
    if (insertError && insertError.code !== "23505") throw insertError;

    if (!insertError) {
      await logSecurityEvent({
        userId: user.id,
        type: "device_limit_reached",
        severity: "warning",
        info,
        meta: { label, activeDevices: devices.map((d) => d.label) },
      });
      await notifyAdmin(profile?.full_name || user.email, user.email, label, info.city);
    }

    return { status: "pending" };
  } catch (error) {
    return toErrorStatus(error);
  }
}

/** Админ берген 6 таңбалы кодты тексеру. 5 қате әрекеттен кейін сұраныс бұғатталады. */
export async function confirmDeviceCode(input: DeviceIdentityInput, code: string): Promise<CodeResult> {
  try {
    const user = await requireUser({ device: false });
    const parsed = identitySchema.safeParse(input);
    if (!parsed.success || !/^\d{6}$/.test(code)) return { ok: false, error: "invalid_input" };
    const { deviceKey, fingerprint } = parsed.data;

    if (!(await rateLimit(`device:code:${user.id}`, 10, 15 * 60))) return { ok: false, error: "rate_limited" };

    const admin = createAdminClient();
    const info = await getRequestInfo();
    const request = await findOpenRequest(user.id, deviceKey);

    if (!request) return { ok: false, error: "no_request" };
    if (request.status === "blocked") return { ok: false, error: "blocked" };
    if (isCodeExpired(request)) {
      await admin.from("device_requests").update({ status: "expired" }).eq("id", request.id);
      return { ok: false, error: "expired" };
    }

    const valid = request.status === "approved" && request.code_hash && verifyCode(request.id, code, request.code_hash);

    if (!valid) {
      const attempts = request.failed_attempts + 1;
      const blocked = attempts >= MAX_CODE_ATTEMPTS;
      await admin
        .from("device_requests")
        .update({ failed_attempts: attempts, ...(blocked ? { status: "blocked" as const } : {}) })
        .eq("id", request.id);
      await logSecurityEvent({
        userId: user.id,
        type: blocked ? "device_code_blocked" : "device_code_failed",
        severity: blocked ? "critical" : "warning",
        info,
        meta: { requestId: request.id, attempts },
      });
      return blocked
        ? { ok: false, error: "blocked" }
        : { ok: false, error: "invalid_code", attemptsLeft: MAX_CODE_ATTEMPTS - attempts };
    }

    // Код дұрыс: админ таңдаған ескі құрылғыны өшіріп, жаңасын қосамыз
    const now = new Date().toISOString();
    if (request.replace_device_id) {
      await admin
        .from("devices")
        .update({ revoked_at: now, revoked_by: request.decided_by })
        .eq("id", request.replace_device_id)
        .eq("user_id", user.id);
    }

    const { data: stillActive } = await admin
      .from("devices")
      .select("id")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: true });
    const overflow = (stillActive ?? []).slice(0, Math.max(0, (stillActive?.length ?? 0) - (MAX_DEVICES - 1)));
    if (overflow.length > 0) {
      await admin
        .from("devices")
        .update({ revoked_at: now, revoked_by: request.decided_by })
        .in("id", overflow.map((d) => d.id));
    }

    const { data: created, error } = await admin
      .from("devices")
      .insert({
        user_id: user.id,
        device_key: deviceKey,
        fingerprint,
        label: deviceLabel(info.userAgent),
        user_agent: info.userAgent,
        last_ip: info.ip,
        last_city: info.city,
        last_country: info.country,
      })
      .select("id")
      .single();
    if (error || !created) throw error ?? new Error("device insert failed");

    await admin.from("device_requests").update({ status: "used" }).eq("id", request.id);
    await setDeviceCookie(user.id, created.id);
    await logSecurityEvent({ userId: user.id, type: "device_confirmed", info, deviceId: created.id });

    return { ok: true };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("confirmDeviceCode failed", error);
    return { ok: false, error: "unknown" };
  }
}

async function notifyAdmin(name: string, email: string, label: string, city: string | null) {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return;
  await sendEmail({
    to,
    subject: `GrantUp: жаңа құрылғы сұранысы — ${name}`,
    html: `<p><b>${escapeHtml(name)}</b> (${escapeHtml(email)}) жаңа құрылғыдан кіргісі келеді.</p>
<p>Құрылғы: ${escapeHtml(label)}${city ? `, ${escapeHtml(city)}` : ""}</p>
<p><a href="${siteUrl}/admin/devices">Админ панельде қарау →</a></p>`,
  });
}
