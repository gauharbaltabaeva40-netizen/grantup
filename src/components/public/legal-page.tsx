import { LEGAL_UPDATED, type LegalDoc } from "@/content/legal";
import type { Locale } from "@/i18n/config";
import { PublicShell } from "./public-shell";

export function LegalPage({ doc, locale, path }: { doc: LegalDoc; locale: Locale; path: string }) {
  const updated = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(LEGAL_UPDATED),
  );
  return (
    <PublicShell locale={locale} path={path}>
      <article className="mx-auto max-w-3xl px-4 py-10 lg:py-14">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{locale === "ru" ? `Редакция от ${updated}` : `${updated} редакциясы`}</p>
        <p className="mt-6 text-[15px] leading-relaxed">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="text-lg font-extrabold">{s.h}</h2>
            {s.p.map((text) => (
              <p key={text} className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {text}
              </p>
            ))}
          </section>
        ))}
      </article>
    </PublicShell>
  );
}
