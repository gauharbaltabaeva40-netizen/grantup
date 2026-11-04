import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_ROUTES, DEVICE_ROUTE, LANDING_LOCALE_HEADER, LANDING_PATH, matchesRoute, PUBLIC_ROUTES } from "@/config/routes";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  signDeviceToken,
  verifyDeviceToken,
} from "@/lib/device/cookie";
import { getAppSecret, isSupabaseConfigured, supabasePublicKey, supabaseUrl } from "@/lib/env";
import { buildCsp, createNonce } from "@/lib/security/csp";
import type { Database } from "@/lib/supabase/types";

/**
 * Әр сұраныста:
 * 1. Supabase сессиясын жаңартады.
 * 2. Кірмеген пайдаланушыға «/» және «/ru» — ашық басты бет (лендинг), қалғанында /login-ге жібереді.
 * 3. Құрылғы cookie-ін тексереді: расталмаған құрылғы → /device (2 құрылғы шегі).
 * 4. Nonce-пен CSP тақырыбын қояды (бөтен скрипттерді бұғаттау).
 * Нақты деректерді қорғау — RLS пен сервердегі тексерулерде; бұл — бірінші қабат.
 */
export async function middleware(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp(nonce);
  // Next.js сұраныс тақырыбындағы CSP-ден nonce-ты оқып, өз скрипттеріне қосады
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);
  // Тіл тақырыбын тек осы middleware қояды (клиенттен келгенін өшіреміз)
  request.headers.delete(LANDING_LOCALE_HEADER);
  const passThrough = () => {
    const res = NextResponse.next({ request: { headers: request.headers } });
    res.headers.set("content-security-policy", csp);
    return res;
  };

  /** Ашық басты бет (іздеу жүйелері үшін): «/» — қазақша, «/ru» — орысша. Тіл cookie-і де соған қойылады. */
  const landing = (locale: Locale, carry?: NextResponse) => {
    request.headers.set(LANDING_LOCALE_HEADER, locale);
    const url = request.nextUrl.clone();
    url.pathname = LANDING_PATH;
    const res = NextResponse.rewrite(url, { request: { headers: request.headers } });
    res.headers.set("content-security-policy", csp);
    for (const cookie of carry?.cookies.getAll() ?? []) res.cookies.set(cookie);
    res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
    return res;
  };
  // Ішкі маршрутқа тікелей кіруге болмайды (қайталанатын мазмұн болмасын)
  if (request.nextUrl.pathname.startsWith(LANDING_PATH)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url, 308);
  }

  // Демо режим: Supabase кілттері жоқ — тексерусіз өткіземіз (тек әзірлеу үшін).
  if (!isSupabaseConfigured) return request.nextUrl.pathname === "/ru" ? landing("ru") : passThrough();

  let response = passThrough();

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = passThrough();
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { pathname, search } = request.nextUrl;

  // Жаңартылған сессия cookie-лерін редиректке де көшіреміз
  const redirectTo = (path: string, clearDevice = false) => {
    const url = request.nextUrl.clone();
    const [p, q] = path.split("?");
    url.pathname = p;
    url.search = q ? `?${q}` : "";
    const res =
      request.method === "GET" || request.method === "HEAD"
        ? NextResponse.redirect(url)
        : NextResponse.json({ error: "unauthorized" }, { status: 401 });
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    if (clearDevice) res.cookies.delete(DEVICE_COOKIE);
    return res;
  };

  if (pathname === "/") {
    if (!userId) return landing("kk", response);
  } else if (pathname === "/ru") {
    return userId ? redirectTo("/") : landing("ru", response);
  }

  if (matchesRoute(pathname, PUBLIC_ROUTES)) return response;

  if (matchesRoute(pathname, AUTH_ROUTES)) {
    return userId ? redirectTo("/") : response;
  }

  const next = encodeURIComponent(pathname + search);
  if (!userId) return redirectTo(`/login?next=${next}`);
  if (pathname === DEVICE_ROUTE) return response;

  // --- Құрылғыны тексеру ---
  const secret = getAppSecret();
  const token = await verifyDeviceToken(secret, request.cookies.get(DEVICE_COOKIE)?.value);

  if (token && token.u === userId) {
    if (!token.expired) return response;

    // Мерзімі өтті: құрылғы әлі белсенді ме (админ өшірмеді ме)?
    const { data: device } = await supabase
      .from("devices")
      .select("id")
      .eq("id", token.d)
      .eq("user_id", userId)
      .is("revoked_at", null)
      .maybeSingle();

    if (device) {
      response.cookies.set(DEVICE_COOKIE, await signDeviceToken(secret, userId, device.id), deviceCookieOptions);
      return response;
    }
  }

  return redirectTo(`${DEVICE_ROUTE}?next=${next}`, true);
}

export const config = {
  matcher: [
    // Статикалық файлдар мен суреттерден басқаның бәрі
    "/((?!_next/static|_next/image|icons/|mediapipe/|models/|logo.png|icon.png|apple-icon.png|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
