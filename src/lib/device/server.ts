import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAppSecret } from "@/lib/env";
import { CODE_TTL_HOURS_PUBLIC } from "./constants";
import { DEVICE_COOKIE, deviceCookieOptions, signDeviceToken } from "./cookie";

/** Бір аккаунттағы белсенді құрылғылардың ең көп саны (админдерге шектеу жоқ). */
export const MAX_DEVICES = 2;
/** Растау кодының жарамдылық мерзімі және қате әрекеттер шегі */
export const CODE_TTL_HOURS = CODE_TTL_HOURS_PUBLIC;
export const MAX_CODE_ATTEMPTS = 5;

export function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Код сұраныс ID-імен байланыстырылып хэштеледі — бір сұраныстың кодын басқасына қолдануға болмайды. */
export function hashCode(requestId: string, code: string): string {
  return createHmac("sha256", getAppSecret()).update(`${requestId}:${code}`).digest("hex");
}

export function verifyCode(requestId: string, code: string, hash: string): boolean {
  const a = Buffer.from(hashCode(requestId, code), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setDeviceCookie(userId: string, deviceId: string) {
  (await cookies()).set(DEVICE_COOKIE, await signDeviceToken(getAppSecret(), userId, deviceId), deviceCookieOptions);
}
