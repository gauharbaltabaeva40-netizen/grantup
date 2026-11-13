import Image from "next/image";
import Link from "next/link";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const FOOTER = {
  kk: { ubt: "ҰБТ-2026 құрылымы", privacy: "Құпиялық саясаты", terms: "Пайдалану шарттары", login: "Кіру", tagline: "ҰБТ-ға онлайн дайындық платформасы" },
  ru: { ubt: "Структура ЕНТ-2026", privacy: "Политика конфиденциальности", terms: "Условия использования", login: "Войти", tagline: "Платформа онлайн-подготовки к ЕНТ" },
};

/** Тілге сай адрес: қазақша — «/x», орысша — «/ru/x» */
export function localePath(locale: Locale, path: string) {
  return locale === "ru" ? (path === "/" ? "/ru" : `/ru${path}`) : path;
}

/** Төменгі сілтемелер (лендинг пен ақпарат беттеріне ортақ) */
export function PublicFooter({ locale }: { locale: Locale }) {
  const t = FOOTER[locale];
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center lg:px-8">
        <div>
          <span className="font-extrabold text-foreground">GrantUp.kz</span>
          <span className="ml-2">{t.tagline}</span>
        </div>
        <nav aria-label="GrantUp.kz" className="flex flex-wrap gap-x-5 gap-y-2 sm:ml-auto">
          <Link href={localePath(locale, "/ubt-2026")} className="hover:text-foreground">
            {t.ubt}
          </Link>
          <Link href={localePath(locale, "/privacy")} className="hover:text-foreground">
            {t.privacy}
          </Link>
          <Link href={localePath(locale, "/terms")} className="hover:text-foreground">
            {t.terms}
          </Link>
          <span>© {new Date().getFullYear()}</span>
        </nav>
      </div>
    </footer>
  );
}

/** Ашық ақпарат беттерінің қаңқасы: логотип, тіл ауыстыру, кіру, төменгі сілтемелер */
export function PublicShell({ locale, path, children }: { locale: Locale; path: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 pt-[env(safe-area-inset-top)] lg:px-8">
        <Link href={localePath(locale, "/")} aria-label="GrantUp" className="inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Image src="/logo.png" alt="" width={34} height={34} className="rounded-full" />
          <span className="text-lg font-extrabold tracking-tight">
            Grant<span className="text-brand-gradient">Up</span>
          </span>
        </Link>
        <nav className="ml-auto flex items-center rounded-full bg-card p-1 text-xs font-bold shadow-soft" aria-label="Тіл / Язык">
          {locales.map((l) => (
            <a
              key={l}
              href={localePath(l, path)}
              hrefLang={l}
              aria-current={l === locale ? "true" : undefined}
              className={cn("rounded-full px-2.5 py-1.5", l === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {localeLabels[l].short}
            </a>
          ))}
        </nav>
        <Link href="/login" className="h-10 rounded-full px-4 text-sm leading-10 font-bold hover:text-primary">
          {FOOTER[locale].login}
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <PublicFooter locale={locale} />
    </div>
  );
}
