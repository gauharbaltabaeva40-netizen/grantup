import "server-only";
import { headers } from "next/headers";
import { isTrustedProxy, PROXY_CLIENT_IP_HEADER } from "@/lib/security/proxy";

export type RequestInfo = {
  ip: string | null;
  city: string | null;
  country: string | null;
  userAgent: string | null;
};

/**
 * IP және геолокация (Vercel тақырыптары; жергілікті ортада бос болуы мүмкін).
 * grantup.kz Қазақстандағы прокси-сервер арқылы келсе, Vercel барлық сұранысты сол сервердің IP-інен көреді —
 * сондықтан нақты IP-ді прокси тақырыбынан аламыз, ал қала/ел (прокси орны) көрсетілмейді.
 */
export async function getRequestInfo(): Promise<RequestInfo> {
  const h = await headers();
  const proxied = isTrustedProxy(h);
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = proxied ? h.get(PROXY_CLIENT_IP_HEADER)?.trim() : forwarded || h.get("x-real-ip");
  const city = proxied ? null : h.get("x-vercel-ip-city");

  return {
    ip: ip && /^[0-9a-fA-F.:]+$/.test(ip) ? ip : null,
    city: city ? safeDecode(city) : null,
    country: proxied ? null : h.get("x-vercel-ip-country"),
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
