export const locales = ["kk", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "kk";

// Тіл URL-да емес, cookie-де сақталады (2-кезеңнен бастап профильдегі тілмен синхрондалады).
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const localeLabels: Record<Locale, { short: string; full: string }> = {
  kk: { short: "ҚАЗ", full: "Қазақша" },
  ru: { short: "РУС", full: "Русский" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
