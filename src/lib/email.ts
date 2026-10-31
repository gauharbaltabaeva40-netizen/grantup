import "server-only";
import { Resend } from "resend";

/** Email жіберу (Resend). Кілт қойылмаса — жібермей, тек логқа жазады. Қате болса, негізгі әрекетті тоқтатпайды. */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY жоқ — email жіберілмеді: "${subject}" → ${to}`);
    return;
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.EMAIL_FROM ?? "GrantUp <no-reply@grantup.kz>",
      to,
      subject,
      html,
    });
    if (error) console.error("[email] send failed", error);
  } catch (error) {
    console.error("[email] send failed", error);
  }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
