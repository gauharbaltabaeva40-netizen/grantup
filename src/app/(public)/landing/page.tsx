import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  CircleCheck,
  CircleX,
  Flame,
  Lightbulb,
  RotateCcw,
  ScanFace,
  Sparkles,
  Target,
  Trophy,
  Video,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

// Ашық басты бет (кірмеген адамдар мен іздеу жүйелері үшін).
// Middleware «/» → қазақша, «/ru» → орысша нұсқасын осы бетке rewrite жасайды.
// Құрылымы әдейі қысқа: бірінші экран (тіркелу сілтемесімен) → 6 ерекшелік → FAQ → шақыру.

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

/** Ерекшелік картасы: белгіше + тақырып + қарапайым түсіндірме + шағын көрнекі мысал */
function Feature({
  icon: Icon,
  tone,
  title,
  text,
  className,
  children,
}: {
  icon: typeof Target;
  tone: string;
  title: string;
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={cn("hover-lift flex flex-col rounded-3xl border border-white/60 bg-card/80 p-5 shadow-soft backdrop-blur-sm sm:p-6 dark:border-white/5", className)}>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm", tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="text-lg leading-tight font-extrabold">{title}</h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-auto pt-5" aria-hidden>
        {children}
      </div>
    </article>
  );
}

export default async function LandingPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("landing");
  const faq = t.raw("faq") as { q: string; a: string }[];
  const url = `${siteUrl}${PATH[locale] === "/" ? "" : PATH[locale]}`;
  const days = t("f.streak.days").split(" ");

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

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      {/* JSON-LD — дерек блогы, орындалмайды (CSP nonce қажет емес) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Сәндік градиент дақтар */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] overflow-hidden">
        <div className="absolute -top-40 -left-32 size-[34rem] animate-[float_14s_ease-in-out_infinite] rounded-full bg-[#0a84ff]/25 blur-3xl dark:bg-[#0a84ff]/20" />
        <div className="absolute -top-24 -right-24 size-[30rem] animate-[float_11s_ease-in-out_infinite_reverse] rounded-full bg-[#7b3ff2]/25 blur-3xl" />
        <div className="absolute top-80 left-1/3 size-[26rem] rounded-full bg-[#f59e0b]/10 blur-3xl" />
      </div>

      <header className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 pt-[env(safe-area-inset-top)] lg:px-8">
        <Logo size={34} href={PATH[locale]} />
        <nav aria-label={t("lang")} className="ml-auto flex items-center rounded-full bg-card/70 p-1 text-xs font-bold shadow-soft backdrop-blur">
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
        {/* ---------------- Бірінші экран ---------------- */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-6 pb-16 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:px-8 lg:pt-14 lg:pb-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-card/70 px-3 py-1 text-sm font-bold text-primary shadow-soft backdrop-blur">
              <Sparkles className="size-4 shrink-0" aria-hidden />
              {t("badge")}
              <span className="hidden sm:inline">· {t("formatLine")}</span>
            </p>
            <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[3.6rem]">
              {t("h1a")} <span className="text-brand-gradient">{t("h1b")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{t("lead")}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className={cn(buttonVariants({ variant: "brand", size: "2xl" }), "hover-lift")}>
                {t("start")}
                <ArrowRight aria-hidden />
              </Link>
              <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "2xl" }), "bg-card/70 backdrop-blur")}>
                {t("login")}
              </Link>
            </div>
            <p className="mt-5 text-[15px] text-muted-foreground">
              {t("signupLine")}{" "}
              <Link href="/signup" className="font-bold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">
                {t("signupLink")} →
              </Link>
            </p>
          </div>

          {/* Платформаның «скриншоты»: мақсат, стрик, лига, жоспар */}
          <div className="relative mx-auto w-full max-w-md" aria-hidden>
            <div className="animate-gradient-drift relative isolate overflow-hidden rounded-[2rem] bg-brand-gradient p-6 text-white shadow-brand">
              <div className="pointer-events-none absolute -top-16 -right-10 -z-10 size-56 animate-[float_9s_ease-in-out_infinite] rounded-full bg-white/15 blur-2xl" />
              <p className="flex items-center gap-1.5 text-sm font-semibold text-white/85">
                <Target className="size-4" /> {t("preview.goal")}
              </p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white/75">{t("preview.score")}</p>
                  <p className="text-5xl font-extrabold tabular-nums">
                    112<span className="text-2xl text-white/70">/140</span>
                  </p>
                </div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{t("preview.left", { n: 8 })}</span>
              </div>
              <div className="relative mt-4 h-3 rounded-full bg-white/20">
                <div className="h-full w-[80%] rounded-full bg-white" />
                <div className="absolute top-1/2 left-[85.7%] h-5 w-1 -translate-y-1/2 rounded-full bg-amber-300" />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm font-bold">
                <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2.5">
                  <Flame className="size-5 shrink-0 text-amber-300" /> {t("preview.streak")}
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-white/15 px-3 py-2.5">
                  <Trophy className="size-5 shrink-0 text-amber-300" /> {t("preview.league")}
                </div>
              </div>
            </div>
            <div className="relative -mt-6 ml-6 rounded-3xl border bg-card p-4 shadow-xl sm:ml-12">
              <p className="mb-2.5 flex items-center gap-1.5 text-sm font-extrabold">
                <CalendarCheck className="size-4 text-primary" /> {t("preview.plan")}
              </p>
              <ul className="space-y-2 text-sm">
                {(["p1", "p2", "p3"] as const).map((k, i) => (
                  <li key={k} className="flex items-center gap-2.5">
                    <span className={cn("grid size-5 place-items-center rounded-full", i === 0 ? "bg-success text-white" : "border-2 border-border")}>
                      {i === 0 && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className={cn(i === 0 && "text-muted-foreground line-through")}>{t(`preview.${k}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---------------- Ерекшеліктер ---------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-8" aria-labelledby="features">
          <div className="max-w-2xl">
            <h2 id="features" className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t("featuresTitle")}</h2>
            <p className="mt-2 text-[15px] text-muted-foreground sm:text-base">{t("featuresLead")}</p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Feature icon={Video} tone="bg-gradient-to-br from-[#0a84ff] to-[#0047ff]" title={t("f.proctor.t")} text={t("f.proctor.d")}>
              <div className="relative mx-auto aspect-[4/3] max-w-56 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950">
                <div className="absolute inset-[18%] rounded-[40%] border-2 border-dashed border-emerald-400/80" />
                <ScanFace className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/80" />
                <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">
                  <Check className="size-3" strokeWidth={3} /> {t("f.proctor.chip")}
                </span>
                <span className="absolute top-2 right-2 size-2.5 animate-pulse rounded-full bg-red-500" />
              </div>
            </Feature>

            <Feature icon={Target} tone="bg-gradient-to-br from-[#22c55e] to-[#0e9f6e]" title={t("f.goal.t")} text={t("f.goal.d")}>
              <div className="rounded-2xl bg-muted/60 p-4">
                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                  <span>{t("f.goal.from")} · 112</span>
                  <span>{t("f.goal.to")} · 120</span>
                </div>
                <div className="relative mt-2 h-3 rounded-full bg-background">
                  <div className="h-full w-[93%] rounded-full bg-gradient-to-r from-[#22c55e] to-[#0e9f6e]" />
                  <div className="absolute top-1/2 right-0 h-5 w-1 -translate-y-1/2 rounded-full bg-foreground" />
                </div>
                <p className="mt-2 text-right text-sm font-extrabold text-success">+8</p>
              </div>
            </Feature>

            <Feature icon={Trophy} tone="bg-gradient-to-br from-[#f59e0b] to-[#ea580c]" title={t("f.league.t")} text={t("f.league.d")}>
              <ol className="space-y-1.5 text-sm">
                {[
                  { n: 1, name: "Аружан", xp: 940 },
                  { n: 2, name: "Нұрсұлтан", xp: 880 },
                  { n: 3, name: t("f.league.you"), xp: 860, you: true },
                ].map((row) => (
                  <li key={row.n} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", row.you ? "bg-[#0047ff] text-white" : "bg-muted/60")}>
                    <span className="w-4 font-extrabold tabular-nums">{row.n}</span>
                    <span className="flex-1 font-semibold">{row.name}</span>
                    <span className="font-bold tabular-nums">{row.xp} XP</span>
                  </li>
                ))}
              </ol>
            </Feature>

            <Feature icon={Flame} tone="bg-gradient-to-br from-[#fb923c] to-[#ef4444]" title={t("f.streak.t")} text={t("f.streak.d")} className="lg:col-span-2">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                {days.map((day, i) => {
                  const done = i < 5;
                  const today = i === 5;
                  return (
                    <div key={day} className="flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "grid size-10 place-items-center rounded-2xl sm:size-12",
                          done
                            ? "bg-gradient-to-br from-[#fb923c] to-[#ef4444] text-white"
                            : today
                              ? "border-2 border-dashed border-[#fb923c] text-[#fb923c]"
                              : "bg-muted text-muted-foreground/50",
                        )}
                      >
                        <Flame className="size-5" />
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">{day}</span>
                    </div>
                  );
                })}
              </div>
            </Feature>

            <Feature icon={CalendarCheck} tone="bg-gradient-to-br from-[#7b3ff2] to-[#4f46e5]" title={t("f.plan.t")} text={t("f.plan.d")}>
              <ul className="space-y-2 rounded-2xl bg-muted/60 p-3.5 text-sm">
                {(["p1", "p2", "p3"] as const).map((k, i) => (
                  <li key={k} className="flex items-center gap-2.5">
                    <span className={cn("grid size-5 place-items-center rounded-md", i < 2 ? "bg-brand-violet text-white" : "border-2 border-border")}>
                      {i < 2 && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {t(`preview.${k}`)}
                  </li>
                ))}
              </ul>
            </Feature>

            <Feature icon={RotateCcw} tone="bg-gradient-to-br from-[#ef4444] to-[#db2777]" title={t("f.mistakes.t")} text={t("f.mistakes.d")} className="md:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap items-center gap-2.5 text-sm font-bold">
                <span className="flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1.5 text-danger">
                  <CircleX className="size-4" /> {t("f.mistakes.wrong")}
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
                <span className="flex items-center gap-1.5 rounded-full bg-brand-violet/10 px-3 py-1.5 text-brand-violet dark:text-[#b69bff]">
                  <Lightbulb className="size-4" /> {t("f.mistakes.explain")}
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
                <span className="flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1.5 text-success">
                  <CircleCheck className="size-4" /> {t("f.mistakes.right")}
                </span>
              </div>
            </Feature>
          </div>
        </section>

        {/* ---------------- Жиі қойылатын сұрақтар ---------------- */}
        <section className="mx-auto max-w-3xl px-4 pb-16 lg:px-8" aria-labelledby="faq">
          <h2 id="faq" className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t("faqTitle")}</h2>
          <div className="mt-6 space-y-2.5">
            {faq.map((item) => (
              <details key={item.q} className="group rounded-2xl bg-card/80 p-4 shadow-soft backdrop-blur-sm sm:p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                  <h3>{item.q}</h3>
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-primary transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------------- Соңғы шақыру ---------------- */}
        <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-8">
          <div className="animate-gradient-drift relative isolate overflow-hidden rounded-[2rem] bg-brand-gradient px-6 py-10 text-center text-white shadow-brand sm:px-12 sm:py-12">
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
