import "server-only";
import { headers } from "next/headers";

export type RequestInfo = {
  ip: string | null;
  city: string | null;
  country: string | null;
  userAgent: string | null;
};

/** IP және геолокация (Vercel тақырыптары; жергілікті ортада бос болуы мүмкін). */
export async function getRequestInfo(): Promise<RequestInfo> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || null;
  const city = h.get("x-vercel-ip-city");

  return {
    ip: ip && /^[0-9a-fA-F.:]+$/.test(ip) ? ip : null,
    city: city ? safeDecode(city) : null,
    country: h.get("x-vercel-ip-country"),
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
