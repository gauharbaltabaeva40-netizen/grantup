import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  Code,
  Landmark,
  Lightbulb,
  PlayCircle,
  Sigma,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

// Ашық басты бет (кірмеген адамдар мен іздеу жүйелері үшін).
// Middleware «/» → қазақша, «/ru» → орысша нұсқасын осы бетке rewrite жасайды.

const PATH: Record<Locale, string> = { kk: "/", ru: "/ru" };

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("landing");
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: { canonical: PATH[locale], languages: { kk: "/", ru: "/ru", "x-default": "/" } },
    openGraph: {
      type: "website",
      url: PATH[locale],
      title: t("metaTitle"),
      description: t("metaDescription"),
      locale: locale === "ru" ? "ru_KZ" : "kk_KZ",
      alternateLocale: locale === "ru" ? "kk_KZ" : "ru_KZ",
      siteName: "GrantUp",
      // Беттің openGraph-ы түбірдегіні толық ауыстырады — суретті қайта көрсетеміз
      images: [{ url: "/og.png", width: 1200, height: 630, alt: t("metaTitle") }],
    },
  };
}

// ҰБТ-2026 спецификациясы (docs/unt-2026-template.md)
const SUBJECTS: { code: "history_kz" | "reading_literacy" | "math_literacy" | "math" | "informatics"; icon: LucideIcon; questions: number; points: number; mandatory: boolean }[] = [
  { code: "history_kz", icon: Landmark, questions: 20, points: 20, mandatory: true },
  { code: "reading_literacy", icon: BookOpen, questions: 10, points: 10, mandatory: true },
  { code: "math_literacy", icon: TrendingUp, questions: 10, points: 10, mandatory: true },
  { code: "math", icon: Sigma, questions: 40, points: 50, mandatory: false },
  { code: "informatics", icon: Code, questions: 40, points: 50, mandatory: false },
];

const FEATURES: { key: "mock" | "explain" | "lessons" | "predict" | "plan" | "league"; icon: LucideIcon }[] = [
  { key: "mock", icon: ClipboardCheck },
  { key: "explain", icon: Lightbulb },
  { key: "lessons", icon: PlayCircle },
  { key: "predict", icon: TrendingUp },
  { key: "plan", icon: CalendarCheck },
  { key: "league", icon: Trophy },
];

export default async function LandingPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("landing");
  const faq = t.raw("faq") as { q: string; a: string }[];
  const url = `${siteUrl}${PATH[locale] === "/" ? "" : PATH[locale]}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": `${siteUrl}/#org`,
        name: "GrantUp",
        url: siteUrl,
        logo: `${siteUrl}/logo.png`,
        description: t("metaDescription"),
        areaServed: "KZ",
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "GrantUp",
        url: siteUrl,
        inLanguage: ["kk", "ru"],
        publisher: { "@id": `${siteUrl}/#org` },
      },
      {
        "@type": "FAQPage",
        url,
        inLanguage: locale,
        mainEntity: faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
      },
    ],
  };

  const cta = cn(buttonVariants({ variant: "brand", size: "2xl" }), "hover-lift");

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      {/* JSON-LD — дерек блогы, орындалмайды (CSP nonce қажет емес) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Сәндік градиент дақтар */}
      <div aria-hidden className="pointer-events-none absolute -top-48 left-1/2 -z-10 h-[34rem] w-[60rem] -translate-x-1/2 animate-[float_12s_ease-in-out_infinite] rounded-full bg-brand-gradient opacity-20 blur-3xl dark:opacity-30" />

      <header className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 pt-[env(safe-area-inset-top)] lg:px-8">
        <Logo size={34} href={PATH[locale]} />
        <nav aria-label={t("lang")} className="ml-auto flex items-center rounded-full bg-card/70 p-1 text-xs font-bold shadow-soft">
          {locales.map((l) => (
            <a
              key={l}
              href={PATH[l]}
              hrefLang={l}
              aria-current={l === locale ? "true" : undefined}
              className={cn("rounded-full px-2.5 py-1.5", l === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {localeLabels[l].short}
            </a>
          ))}
        </nav>
        <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-10 rounded-full px-4 font-bold")}>
          {t("login")}
        </Link>
      </header>

      <main>
        {/* Басты блок */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-14 lg:grid-cols-[1.15fr_1fr] lg:px-8 lg:pt-16 lg:pb-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-bold text-primary">
              <Sparkles className="size-4" aria-hidden />
              {t("badge")}
            </p>
            <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">{t("h1")}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{t("lead")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={cta}>
                {t("start")}
                <ArrowRight aria-hidden />
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "2xl" })}>
                {t("login")}
              </Link>
            </div>
          </div>

          {/* Сынақ ҰБТ көрсеткіштері */}
          <div className="animate-gradient-drift relative isolate overflow-hidden rounded-3xl bg-brand-gradient p-6 text-white shadow-brand sm:p-8">
            <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 -z-10 size-56 animate-[float_9s_ease-in-out_infinite] rounded-full bg-white/15 blur-2xl" />
            <p className="text-sm font-bold text-white/80">{t("formatTitle")}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
              {(
                [
                  ["120", t("stats.questions")],
                  ["140", t("stats.points")],
                  ["240", t("stats.minutes")],
                  ["5", t("stats.subjects")],
                ] as const
              ).map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block text-4xl font-extrabold tabular-nums">{value}</span>
                    <span className="text-sm font-semibold text-white/85">{label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Артықшылықтар */}
        <section className="mx-auto max-w-6xl px-4 py-12 lg:px-8" aria-labelledby="features">
          <h2 id="features" className="text-3xl font-extrabold tracking-tight">{t("featuresTitle")}</h2>
          <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-gradient" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon }) => (
              <article key={key} className="hover-lift rounded-3xl bg-card p-6 shadow-soft">
                <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold">{t(`features.${key}.t`)}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{t(`features.${key}.d`)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Пәндер және ҰБТ құрылымы */}
        <section className="mx-auto max-w-6xl px-4 py-12 lg:px-8" aria-labelledby="subjects">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 id="subjects" className="text-3xl font-extrabold tracking-tight">{t("subjectsTitle")}</h2>
              <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-gradient" />
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{t("subjectsText")}</p>
              <ul className="mt-6 space-y-2.5">
                {SUBJECTS.map(({ code, icon: Icon, questions, mandatory }) => (
                  <li key={code} className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-soft">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{t(`subjects.${code}`)}</span>
                      <span className="text-sm text-muted-foreground">{t("qCount", { count: questions })}</span>
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", mandatory ? "bg-secondary text-primary" : "bg-brand-violet/10 text-brand-violet dark:text-[#b69bff]")}>
                      {mandatory ? t("mandatory") : t("profile")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">{t("formatTitle")}</h2>
              <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-gradient" />
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{t("formatText")}</p>
              <div className="mt-6 overflow-hidden rounded-2xl bg-card shadow-soft">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70 text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 text-left font-bold">{t("colSubject")}</th>
                      <th scope="col" className="px-4 py-2.5 text-center font-bold">{t("colQuestions")}</th>
                      <th scope="col" className="px-4 py-2.5 text-center font-bold">{t("colPoints")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y tabular-nums">
                    {SUBJECTS.map((s) => (
                      <tr key={s.code}>
                        <th scope="row" className="px-4 py-2.5 text-left font-semibold">{t(`subjects.${s.code}`)}</th>
                        <td className="px-4 py-2.5 text-center">{s.questions}</td>
                        <td className="px-4 py-2.5 text-center">{s.points}</td>
                      </tr>
                    ))}
                    <tr className="bg-secondary/60 font-extrabold">
                      <th scope="row" className="px-4 py-2.5 text-left">{t("total")}</th>
                      <td className="px-4 py-2.5 text-center">120</td>
                      <td className="px-4 py-2.5 text-center">140</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Қалай жұмыс істейді */}
        <section className="mx-auto max-w-6xl px-4 py-12 lg:px-8" aria-labelledby="how">
          <h2 id="how" className="text-3xl font-extrabold tracking-tight">{t("howTitle")}</h2>
          <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-gradient" />
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {(["s1", "s2", "s3"] as const).map((step, i) => (
              <li key={step} className="rounded-3xl bg-card p-6 shadow-soft">
                <span className="text-brand-gradient text-4xl font-extrabold">{i + 1}</span>
                <h3 className="mt-2 text-lg font-bold">{t(`how.${step}.t`)}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{t(`how.${step}.d`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Жиі қойылатын сұрақтар */}
        <section className="mx-auto max-w-3xl px-4 py-12 lg:px-8" aria-labelledby="faq">
          <h2 id="faq" className="text-3xl font-extrabold tracking-tight">{t("faqTitle")}</h2>
          <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-gradient" />
          <div className="mt-8 space-y-3">
            {faq.map((item) => (
              <details key={item.q} className="group rounded-2xl bg-card p-5 shadow-soft">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                  <h3>{item.q}</h3>
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-primary transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Соңғы шақыру */}
        <section className="mx-auto max-w-6xl px-4 pt-6 pb-16 lg:px-8">
          <div className="animate-gradient-drift relative isolate overflow-hidden rounded-3xl bg-brand-gradient px-6 py-10 text-center text-white shadow-brand sm:px-12 sm:py-14">
            <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 -z-10 size-64 rounded-full bg-[#7b3ff2]/40 blur-3xl" />
            <h2 className="text-3xl font-extrabold tracking-tight text-balance">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">{t("ctaText")}</p>
            <Link href="/signup" className={cn(buttonVariants({ variant: "white", size: "2xl" }), "hover-lift mt-7")}>
              {t("start")}
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row lg:px-8">
          <Logo size={28} href={PATH[locale]} />
          <span>{t("footer")}</span>
          <span className="sm:ml-auto">© {new Date().getFullYear()} GrantUp.kz</span>
        </div>
      </footer>
    </div>
  );
}
