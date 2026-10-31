import type { AppLocale } from "@/lib/supabase/types";

/** Қос тілді өрістен ағымдағы тілдегі мәнді алу: localized(row, "title", "kk") → row.title_kk */
export function localized<K extends string>(
  row: { [P in `${K}_kk` | `${K}_ru`]: string },
  key: K,
  locale: string,
): string {
  const value = row[`${key}_${locale === "ru" ? "ru" : "kk"}` as `${K}_kk`];
  // Аударма бос болса, екінші тілді көрсетеміз
  return value || row[`${key}_${locale === "ru" ? "kk" : "ru"}` as `${K}_kk`];
}

export function asLocale(locale: string): AppLocale {
  return locale === "ru" ? "ru" : "kk";
}
