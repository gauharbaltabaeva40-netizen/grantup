"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/config/routes";
import { DEVICE_COOKIE } from "@/lib/device/cookie";
import { isSupabaseConfigured, siteUrl, supabasePublicKey, supabaseUrl } from "@/lib/env";
import { LOCALE_COOKIE } from "@/i18n/config";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { recordLogin } from "@/lib/security/events";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  type FormState,
  changePasswordSchema,
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

const YEAR = 60 * 60 * 24 * 365;

async function setLocaleCookie(locale: string) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

function pick(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["fullName", "email", "grade", "locale", "profilePair"]);
  if (!isSupabaseConfigured) return { error: "not_configured", values };

  const parsed = signUpSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) return { error: "invalid_input", values };

  const info = await getRequestInfo();
  if (!(await rateLimit(`signup:ip:${info.ip ?? "unknown"}`, 5, 60 * 60))) {
    return { error: "rate_limited", values };
  }

  const { fullName, email, password, grade, locale } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, grade, locale },
      emailRedirectTo: `${siteUrl}/auth/confirm?next=/device`,
    },
  });

  if (error) {
    if (error.code === "weak_password") return { error: "weak_password", values };
    if (error.code === "over_email_send_rate_limit" || error.status === 429) return { error: "rate_limited", values };
    // Email растау өшірулі болса, Supabase бар email-ге нақты қате қайтарады
    if (error.code === "user_already_exists" || error.code === "email_exists") return { error: "email_taken", values };
    // Email бұрыннан тіркелген болса да, Supabase қауіпсіздік үшін сәтті жауап береді — бөлек хабарламаймыз.
    console.error("signUp failed", error);
    return { error: "unknown", values };
  }

  await setLocaleCookie(locale);
  // Supabase-те «Confirm email» өшірулі болса, сессия бірден ашылады — құрылғыны тіркеуге өтеміз.
  // Қосулы болса — поштаны растау беті.
  if (data.session) {
    try {
      await recordLogin(data.session.user.id, info);
    } catch (e) {
      console.error("recordLogin failed", e);
    }
    redirect("/device");
  }
  redirect("/check-email");
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["email", "next"]);
  if (!isSupabaseConfigured) return { error: "not_configured", values };

  const parsed = signInSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) return { error: "invalid_input", values };

  const { email, password, next } = parsed.data;
  const info = await getRequestInfo();
  const allowed =
    (await rateLimit(`login:ip:${info.ip ?? "unknown"}`, 20, 15 * 60)) &&
    (await rateLimit(`login:email:${email}`, 10, 15 * 60));
  if (!allowed) return { error: "rate_limited", values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return { error: "email_not_confirmed", values };
    if (error?.status === 429) return { error: "rate_limited", values };
    return { error: "invalid_credentials", values };
  }

  try {
    await recordLogin(data.user.id, info);
  } catch (e) {
    console.error("recordLogin failed", e);
  }

  const { data: profile } = await supabase.from("profiles").select("locale").eq("id", data.user.id).maybeSingle();
  if (profile) await setLocaleCookie(profile.locale);

  redirect(`/device?next=${encodeURIComponent(safeNext(next))}`);
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(DEVICE_COOKIE);
  redirect("/login");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["email"]);
  if (!isSupabaseConfigured) return { error: "not_configured", values };

  const parsed = resetRequestSchema.safeParse(values);
  if (!parsed.success) return { error: "invalid_input", values };

  const info = await getRequestInfo();
  const allowed =
    (await rateLimit(`reset:ip:${info.ip ?? "unknown"}`, 5, 60 * 60)) &&
    (await rateLimit(`reset:email:${parsed.data.email}`, 3, 60 * 60));
  if (!allowed) return { error: "rate_limited", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error) console.error("resetPasswordForEmail failed", error);

  // Email тіркелген-тіркелмегенін ашпау үшін әрдайым «жіберілді» деп жауап береміз.
  return { ok: true };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "not_configured" };

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((i) => i.message === "password_mismatch");
    return { error: mismatch ? "password_mismatch" : "invalid_input" };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "session_expired" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "same_password" };
    if (error.code === "weak_password") return { error: "weak_password" };
    console.error("updateUser failed", error);
    return { error: "unknown" };
  }

  redirect("/device?next=/");
}

/**
 * Құпиясөзді өзгерту (профильден немесе әкімші уақытша құпиясөз бергеннен кейін).
 * Ағымдағы құпиясөз бөлек, сессиясыз клиентпен тексеріледі; жаңасы service_role арқылы қойылады.
 */
export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured) return { error: "not_configured" };

  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((i) => i.message === "password_mismatch");
    return { error: mismatch ? "password_mismatch" : "invalid_input" };
  }
  const { current, password } = parsed.data;
  if (current === password) return { error: "same_password" };

  const user = await getSessionUser();
  if (!user) return { error: "session_expired" };
  if (!(await rateLimit(`password:change:${user.id}`, 10, 15 * 60))) return { error: "rate_limited" };

  const verifier = createSupabaseClient(supabaseUrl, supabasePublicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: check, error: checkError } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
  if (checkError || check.user?.id !== user.id) return { error: "wrong_current" };
  // Тексеру үшін ашылған уақытша сессияны жабамыз (басқа құрылғылардағы сессияларға тимейді)
  await verifier.auth.signOut({ scope: "local" }).catch(() => {});

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) {
    if (error.code === "weak_password") return { error: "weak_password" };
    console.error("change password failed", error);
    return { error: "unknown" };
  }
  await admin.from("profiles").update({ must_change_password: false }).eq("id", user.id);

  if (formData.get("forced") === "1") redirect("/");
  return { ok: true };
}
