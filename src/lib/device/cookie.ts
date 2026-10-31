// Құрылғы cookie-і: "осы браузер — пайдаланушының расталған құрылғысы" деген қолтаңбалы белгі.
// Web Crypto қолданылады, сондықтан middleware (edge) мен серверде бірдей жұмыс істейді.
// Cookie қысқа мерзімді (DEVICE_COOKIE_TTL): мерзімі біткенде middleware құрылғының әлі белсенді екенін
// дерекқордан қайта тексереді — админ өшірген құрылғы ең көбі осы уақыт ішінде ажыратылады.

export const DEVICE_COOKIE = "gu_dev";
export const DEVICE_COOKIE_TTL = 10 * 60; // секунд

export type DeviceToken = { u: string; d: string; e: number };

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signDeviceToken(secret: string, userId: string, deviceId: string): Promise<string> {
  const payload: DeviceToken = { u: userId, d: deviceId, e: Math.floor(Date.now() / 1000) + DEVICE_COOKIE_TTL };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${toBase64Url(await hmac(secret, body))}`;
}

/** Қолтаңба дұрыс болса токенді қайтарады (мерзімі өтсе де — `expired` белгісімен), әйтпесе null. */
export async function verifyDeviceToken(
  secret: string,
  token: string | undefined,
): Promise<(DeviceToken & { expired: boolean }) | null> {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  try {
    const expected = await hmac(secret, body);
    if (!timingSafeEqual(expected, fromBase64Url(signature))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as DeviceToken;
    if (typeof payload.u !== "string" || typeof payload.d !== "string" || typeof payload.e !== "number") return null;
    return { ...payload, expired: payload.e < Math.floor(Date.now() / 1000) };
  } catch {
    return null;
  }
}

export const deviceCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Cookie-дің өзі ұзақ сақталады; ішіндегі `e` мерзімі қысқа — қайта тексеру үшін.
  maxAge: 60 * 60 * 24 * 30,
};
