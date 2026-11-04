import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LANDING_LOCALE_HEADER } from "@/config/routes";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./config";

export default getRequestConfig(async () => {
  // Ашық басты бетте тіл URL-дан («/» немесе «/ru»), қалған жерде — cookie-ден
  const landingLocale = (await headers()).get(LANDING_LOCALE_HEADER);
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(landingLocale) ? landingLocale : isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    timeZone: "Asia/Almaty",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
