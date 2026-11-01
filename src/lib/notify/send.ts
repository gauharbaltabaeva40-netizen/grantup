import "server-only";
import { createTranslator } from "next-intl";
import webpush from "web-push";
import kk from "../../../messages/kk.json";
import ru from "../../../messages/ru.json";
import { escapeHtml, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotifyKind = "push_streak" | "push_league_zone" | "push_week" | "email_weekly" | "email_access_expiry";

/** Хабарлама мәтіндері оқушының тілінде (cron ішінде — сұраныс cookie-ге тәуелсіз). */
export function notifyT(locale: string) {
  return createTranslator({ locale: locale === "ru" ? "ru" : "kk", messages: locale === "ru" ? ru : kk, namespace: "notify" });
}

/**
 * Бір хабарламаны бір рет қана жіберу: алдымен журналға жазамыз (unique), жазылмаса — бұрын жіберілген.
 * Cron қайта іске қосылса да, оқушыға екі рет бармайды.
 */
async function claim(userId: string, kind: NotifyKind, ref: string, channel: "push" | "email") {
  const { data, error } = await createAdminClient()
    .from("notification_log")
    .insert({ user_id: userId, kind, ref, channel })
    .select("id")
    .single();
  if (error) {
    if (error.code !== "23505") console.error("notification_log insert failed", error);
    return null;
  }
  return data.id;
}

async function markDelivered(logId: number, delivered: number) {
  await createAdminClient().from("notification_log").update({ delivered }).eq("id", logId);
}

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@grantup.kz", publicKey, privateKey);
  vapidReady = true;
  return true;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string; lang?: string };

/** Оқушының барлық құрылғыларына push. Ескірген жазылымдар (404/410) өшіріледі. Қайтарады: жеткізілген саны. */
export async function pushToUser(userId: string, kind: NotifyKind, ref: string, payload: PushPayload): Promise<number> {
  if (!ensureVapid()) return 0;
  const admin = createAdminClient();
  const { data: subscriptions } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!subscriptions?.length) return 0;

  const logId = await claim(userId, kind, ref, "push");
  if (logId === null) return 0;

  let delivered = 0;
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 6 * 3600, urgency: "normal" },
        );
        delivered++;
        await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push send failed", status, (error as Error).message);
      }
    }),
  );
  await markDelivered(logId, delivered);
  return delivered;
}

export async function emailToUser(
  userId: string,
  kind: NotifyKind,
  ref: string,
  message: { to: string; subject: string; html: string },
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  const logId = await claim(userId, kind, ref, "email");
  if (logId === null) return false;
  const ok = await sendEmail(message);
  await markDelivered(logId, ok ? 1 : 0);
  return ok;
}

/** Бренд стиліндегі қарапайым email (inline стильдер — пошта клиенттері үшін). Мәтіндер escapeHtml арқылы. */
export function emailLayout({
  title,
  intro,
  rows = [],
  cta,
  footer,
}: {
  title: string;
  intro: string;
  rows?: [string, string][];
  cta?: { label: string; path: string };
  footer: string;
}) {
  const table = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:10px 0;border-bottom:1px solid #E2E8F5;color:#5B6785;font-size:14px">${escapeHtml(k)}</td><td style="padding:10px 0;border-bottom:1px solid #E2E8F5;text-align:right;font-weight:700;font-size:15px;color:#0B1533">${escapeHtml(v)}</td></tr>`,
  )
  .join("\n")}
</table>`
    : "";
  const button = cta
    ? `<p style="margin:24px 0 8px"><a href="${siteUrl}${cta.path}" style="display:inline-block;background:#0047FF;background-image:linear-gradient(135deg,#0A84FF,#0047FF,#7B3FF2);color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:14px">${escapeHtml(cta.label)}</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#F5F8FF;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;padding:28px">
<tr><td>
<p style="margin:0 0 16px;font-size:20px;font-weight:800;color:#0B1533">Grant<span style="color:#0047FF">Up</span></p>
<h1 style="margin:0 0 8px;font-size:20px;color:#0B1533">${escapeHtml(title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.5;color:#0B1533">${escapeHtml(intro)}</p>
${table}${button}
<p style="margin:24px 0 0;font-size:12px;color:#5B6785">${escapeHtml(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}
