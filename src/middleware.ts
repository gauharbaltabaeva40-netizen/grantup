import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_ROUTES, DEVICE_ROUTE, matchesRoute, PUBLIC_ROUTES } from "@/config/routes";
import {
  DEVICE_COOKIE,
  deviceCookieOptions,
  signDeviceToken,
  verifyDeviceToken,
} from "@/lib/device/cookie";
import { getAppSecret, isSupabaseConfigured, supabasePublicKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Әр сұраныста:
 * 1. Supabase сессиясын жаңартады.
 * 2. Кірмеген пайдаланушыны /login-ге жібереді.
 * 3. Құрылғы cookie-ін тексереді: расталмаған құрылғы → /device (2 құрылғы шегі).
 * Нақты деректерді қорғау — RLS пен сервердегі тексерулерде; бұл — бірінші қабат.
 */
export async function middleware(request: NextRequest) {
  // Демо режим: Supabase кілттері жоқ — тексерусіз өткіземіз (тек әзірлеу үшін).
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
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
    "/((?!_next/static|_next/image|icons/|logo.png|icon.png|apple-icon.png|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
