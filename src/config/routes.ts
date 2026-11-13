// Маршруттар топтары — middleware мен редиректтер осы жерден оқиды.

/** Кірусіз ашылатын беттер (кірген пайдаланушы бұлардан басты бетке бағытталады). */
export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/check-email"];

/** Кірусіз де, кірген күйде де ашылатын беттер. */
export const PUBLIC_ROUTES = ["/auth/confirm", "/reset-password", "/manifest.webmanifest", "/api/cron", "/verify"];

/** Ашық басты беттің ішкі маршруты: «/» және «/ru» осыған rewrite жасалады. */
export const LANDING_PATH = "/landing";
/** Лендинг тілі (middleware қояды, i18n/request.ts оқиды) */
export const LANDING_LOCALE_HEADER = "x-gu-landing-locale";

/** Кіру керек, бірақ құрылғы тексерілмейді (құрылғыны тіркеу беті). */
export const DEVICE_ROUTE = "/device";

export function matchesRoute(pathname: string, routes: string[]) {
  return routes.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Ашық редирект шабуылынан қорғау: тек сайт ішіндегі салыстырмалы жолдар. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
