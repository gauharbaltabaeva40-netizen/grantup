import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEVICE_COOKIE, verifyDeviceToken } from "@/lib/device/cookie";
import { getAppSecret, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export type SessionUser = { id: string; email: string };

export class AuthError extends Error {
  constructor(public code: "not_configured" | "unauthenticated" | "device_required" | "forbidden") {
    super(code);
  }
}

/** Ағымдағы пайдаланушы (JWT тексеріледі). Бір сұраныс ішінде кэштеледі. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: String(claims.email ?? "") };
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/** Осы браузер пайдаланушының расталған (белсенді) құрылғысы ма? */
export async function hasVerifiedDevice(userId: string): Promise<boolean> {
  const token = await verifyDeviceToken(getAppSecret(), (await cookies()).get(DEVICE_COOKIE)?.value);
  if (!token || token.u !== userId) return false;
  if (!token.expired) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("devices")
    .select("id")
    .eq("id", token.d)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  return Boolean(data);
}

/** Осы браузердің құрылғы ID-і (cookie-ден), «Осы құрылғы» белгісі үшін. */
export async function getCurrentDeviceId(): Promise<string | null> {
  const token = await verifyDeviceToken(getAppSecret(), (await cookies()).get(DEVICE_COOKIE)?.value);
  return token?.d ?? null;
}

/**
 * Server Action / Route Handler басында шақырылады.
 * Middleware-ге ғана сенбейміз: action-ды кез келген жолға POST етіп шақыруға болады.
 */
export async function requireUser({ device = true }: { device?: boolean } = {}): Promise<SessionUser> {
  if (!isSupabaseConfigured) throw new AuthError("not_configured");
  const user = await getSessionUser();
  if (!user) throw new AuthError("unauthenticated");
  if (device && !(await hasVerifiedDevice(user.id))) throw new AuthError("device_required");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") throw new AuthError("forbidden");
  return user;
}
