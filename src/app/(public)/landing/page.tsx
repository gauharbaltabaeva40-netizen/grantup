import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, CalendarCheck, Check, CircleCheck, CircleX, Flame, Lightbulb, RotateCcw, ScanFace, Target, Trophy, Video, X } from "lucide-react";
import { PenCheck, PenCircle, Stamp } from "@/components/brand/pen-marks";
import { PublicFooter } from "@/components/public/public-shell";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

// Ашық басты бет (кірмеген адамдар мен іздеу жүйелері үшін).
// Middleware «/» → қазақша, «/ru» → орысша нұсқасын осы бетке rewrite жасайды.
// Дизайн: «Емтихан қағазы» — ақшыл қағаз, қара көк сия, қызыл қалам белгілері, «РАСТАЛДЫ» мөрі.
// Құрылымы: бірінші экран (тіркелу сілтемесі + жауап парағы) → 7 ерекшелік («сұрақтар») → FAQ → шақыру.

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

/** Ерекшелік — емтихан сұрағы сияқты: шетте нөмір, тақырып, қарапайым түсіндірме, шағын көрнекі мысал */
function Feature({
  n,
  icon: Icon,
  title,
  text,
  className,
  children,
}: {
  n: number;
  icon: typeof Target;
  title: string;
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={cn("reveal hover-lift relative flex flex-col rounded-2xl border bg-card p-6 pl-14 shadow-soft sm:pl-16", className)}>
      {/* Дәптердің қызыл шет сызығы + сұрақ нөмірі */}
      <div aria-hidden className="absolute inset-y-0 left-10 w-px bg-pen/35 sm:left-12" />
      <span aria-hidden className="absolute top-6 left-0 w-10 text-center font-serif text-lg font-bold text-pen tabular-nums sm:w-12">
        {n}.
      </span>
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden />
        <h3 className="text-lg leading-tight font-extrabold tracking-tight">{title}</h3>
      </div>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-auto pt-6" aria-hidden>
        {children}
      </div>
    </article>
  );
}

/** Жауап парағындағы бір жол: нөмір + A–E дөңгелектері */
function SheetRow({ n, mark, wrong }: { n: number; mark: number; wrong?: number }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-5 text-right text-xs font-bold text-[#5c6276] tabular-nums">{n}</span>
      <span className="flex gap-1.5">
        {["A", "B", "C", "D", "E"].map((letter, i) => (
          <span
            key={letter}
            className={cn(
              "relative grid size-6 place-items-center rounded-full border text-[10px] font-bold",
              i === mark ? "border-[#1d3a8a] bg-[#1d3a8a] text-white" : "border-[#cfc6b0] text-[#8a8f9e]",
            )}
          >
            {letter}
            {i === wrong && <X className="absolute size-7 text-[#c8371f]" strokeWidth={2.5} />}
          </span>
        ))}
      </span>
      {wrong === undefined ? <PenCheck className="ml-1 h-4 w-5" delay={0.5 + n * 0.12} /> : <span className="ml-1 font-hand text-lg leading-none text-[#c8371f]">−1</span>}
    </li>
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
    <div className="relative min-h-dvh overflow-x-clip">
      {/* JSON-LD — дерек блогы, орындалмайды (CSP nonce қажет емес) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <header className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 pt-[env(safe-area-inset-top)] lg:px-8">
        <Link href={PATH[locale]} aria-label="GrantUp" className="inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Image src="/logo.png" alt="" width={34} height={34} priority className="rounded-full" />
          <span className="text-lg font-extrabold tracking-tight">
            Grant<span className="text-pen">Up</span>
          </span>
        </Link>
        <nav aria-label={t("lang")} className="ml-auto flex items-center rounded-full border bg-card p-1 text-xs font-bold">
          {locales.map((l) => (
            <a
              key={l}
              href={PATH[l]}
              hrefLang={l}
              aria-current={l === locale ? "true" : undefined}
              className={cn("rounded-full px-2.5 py-1.5 transition-colors", l === locale ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {localeLabels[l].short}
            </a>
          ))}
        </nav>
        <Link href="/login" className="h-10 rounded-full px-4 text-sm leading-10 font-bold text-foreground/80 transition-colors hover:text-foreground">
          {t("login")}
        </Link>
      </header>

      <main>
        {/* ================= Бірінші экран ================= */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-8 pb-20 lg:grid-cols-[1.08fr_1fr] lg:px-8 lg:pt-14 lg:pb-28">
          <div>
            {/* Емтихан бетінің «тақырыбы» */}
            <p className="mb-7 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-dashed border-foreground/20 pb-3 text-sm font-bold tracking-wide text-muted-foreground">
              <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-extrabold tracking-[0.12em] text-primary-foreground uppercase">{t("badge")}</span>
              <span className="tabular-nums">{t("formatLine")}</span>
            </p>
            <h1 className="text-[2.6rem] leading-[1.08] font-bold tracking-[-0.02em] text-balance sm:text-6xl lg:text-[4.2rem]">
              {t("h1a")}{" "}
              <span className="pen-underline text-primary">{t("h1b")}</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground">{t("lead")}</p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="group inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-primary px-7 text-lg font-extrabold text-primary-foreground shadow-[4px_4px_0_var(--pen)] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--pen)] active:translate-y-0 active:shadow-[2px_2px_0_var(--pen)]"
              >
                {t("start")}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link href="/login" className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-foreground/15 bg-card px-7 text-lg font-bold transition-colors hover:border-foreground/40">
                {t("login")}
              </Link>
            </div>
            <p className="mt-6 text-[15px] text-muted-foreground">
              {t("signupLine")}{" "}
              <Link href="/signup" className="font-bold text-foreground underline decoration-pen decoration-2 underline-offset-4 hover:text-pen">
                {t("signupLink")} →
              </Link>
            </p>
            <p className="mt-3 text-xs font-bold tracking-[0.14em] text-muted-foreground/80 uppercase">{t("heroNote")}</p>
          </div>

          {/* Көрініс: тексерілген жауап парағы + камера «суреті» + мөр */}
          <div className="relative mx-auto w-full max-w-md pt-6 pb-24 sm:pb-20" aria-hidden>
            <div className="relative rotate-[1.5deg] rounded-md bg-[#fffdf8] p-6 pl-12 text-[#14213d] shadow-[0_1px_0_rgba(20,33,61,0.08),0_30px_60px_-30px_rgba(20,33,61,0.45)] ring-1 ring-[#e6dfcd]">
              <div className="absolute inset-y-0 left-8 w-px bg-[#c8371f]/45" />
              <div className="border-b-2 border-[#14213d] pb-2 pr-24">
                <p className="font-serif text-xl font-bold">{t("sheet.title")}</p>
                <p className="mt-0.5 text-xs font-bold tracking-wide text-[#5c6276] uppercase">{t("sheet.exam")}</p>
              </div>
              <p className="mt-3 flex items-end gap-2 text-xs font-bold text-[#5c6276]">
                {t("sheet.student")}:
                <span className="flex-1 border-b border-[#cfc6b0] pb-0.5 font-hand text-xl leading-none text-[#1d3a8a]">Айгерім С.</span>
              </p>

              <ol className="mt-5 space-y-2.5">
                <SheetRow n={12} mark={2} />
                <SheetRow n={13} mark={0} />
                <SheetRow n={14} mark={3} wrong={3} />
                <SheetRow n={15} mark={1} />
                <SheetRow n={16} mark={4} />
              </ol>

              <div className="mt-6 border-t border-dashed border-[#cfc6b0] pt-4 text-right">
                <p className="text-xs font-bold tracking-wide text-[#5c6276] uppercase">{t("sheet.score")}</p>
                <p className="relative mt-2 inline-block px-3 font-hand text-5xl leading-none font-bold text-[#c8371f]">
                  118<span className="text-3xl">/140</span>
                  <PenCircle className="absolute -inset-x-2 -inset-y-3 h-[calc(100%+1.5rem)] w-[calc(100%+1rem)]" delay={1.4} />
                </p>
                <p className="mt-3 font-hand text-lg leading-none text-[#c8371f]">{t("sheet.note")}</p>
              </div>

              <Stamp label={t("stamp")} sub={t("stampSub")} animate delay={1.9} rotate={-10} className="absolute -top-8 -right-6 size-32 bg-[#fffdf8]/40" />
            </div>

            {/* Камера «суреті» — скотчпен жабыстырылған */}
            <div className="absolute bottom-0 -left-3 w-40 -rotate-[5deg] rounded-sm bg-white p-2 pb-3 shadow-xl ring-1 ring-black/5 sm:-left-12 sm:w-44">
              <div className="absolute -top-3 left-1/2 h-6 w-16 -translate-x-1/2 rotate-[3deg] bg-[#f4e7b8]/85 shadow-sm" />
              <div className="relative aspect-[4/3] overflow-hidden rounded-[2px] bg-gradient-to-br from-[#25304f] to-[#0e1322] [--scan-distance:5.5rem]">
                <div className="absolute inset-[16%] rounded-[42%] border-2 border-dashed border-emerald-300/80" />
                <ScanFace className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-white/80" />
                <div className="absolute inset-x-2 top-2 h-px animate-[scan_4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-emerald-300 to-transparent" />
                <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  <span className="size-1.5 animate-pulse rounded-full bg-red-400" /> {t("show.live")}
                </span>
              </div>
              <ul className="mt-2 space-y-0.5 px-0.5 text-[11px] font-bold text-[#14213d]">
                {[t("show.camera"), t("show.noPhone"), t("show.eyes")].map((label) => (
                  <li key={label} className="flex items-center gap-1.5">
                    <Check className="size-3.5 shrink-0 text-[#c8371f]" strokeWidth={3} />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ================= Ерекшеліктер ================= */}
        <section className="border-y bg-card/60" aria-labelledby="features">
          <div className="mx-auto max-w-6xl px-4 py-20 lg:px-8 lg:py-28">
            <div className="reveal max-w-2xl">
              <p className="font-hand text-2xl leading-none text-pen">{t("featuresNote")}</p>
              <h2 id="features" className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
                {t("featuresTitle")}
              </h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">{t("featuresLead")}</p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* 1. Прокторингпен расталған нәтиже — басты карта (сия фоны) */}
              <article className="reveal hover-lift relative isolate flex flex-col overflow-hidden rounded-2xl bg-brand-gradient p-6 pl-14 text-white shadow-brand sm:pl-16 md:col-span-2">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:24px_24px]"
                />
                <div aria-hidden className="absolute inset-y-0 left-10 w-px bg-[#ff8466]/55 sm:left-12" />
                <span aria-hidden className="absolute top-6 left-0 w-10 text-center font-serif text-lg font-bold text-[#ff8466] sm:w-12">
                  1.
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-extrabold tracking-tight">{t("f.cert.t")}</h3>
                  <span className="rounded-md border border-white/25 px-2 py-0.5 text-xs font-bold text-white/85">{t("f.cert.chip")}</span>
                </div>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/75">{t("f.cert.d")}</p>
                <div className="mt-auto pt-8" aria-hidden>
                  <div className="relative flex items-center gap-5 overflow-hidden rounded-lg bg-[#fffdf8] p-5 text-[#14213d] shadow-xl">
                    {/* Сертификаттағыдай: үлкен әлсіз логотип */}
                    <Image src="/logo.png" alt="" width={220} height={220} className="pointer-events-none absolute -right-10 -bottom-12 opacity-[0.06]" />
                    <Stamp label={t("f.cert.verified")} sub={t("stampSub")} rotate={-14} className="absolute top-[calc(50%-3.5rem)] left-[42%] size-28 text-[#c8371f] sm:left-1/2" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold tracking-wide text-[#5c6276] uppercase">{t("f.cert.score")}</p>
                      <p className="font-serif text-4xl font-bold tabular-nums">
                        118<span className="text-xl text-[#8a8f9e]">/140</span>
                      </p>
                    </div>
                    <div className="grid size-16 shrink-0 grid-cols-5 gap-0.5 rounded-md bg-white p-1 ring-1 ring-[#e6dfcd] sm:size-20">
                      {Array.from({ length: 25 }, (_, k) => (
                        <span key={k} className={cn("rounded-[1px]", [0, 1, 3, 4, 5, 7, 9, 12, 15, 17, 19, 20, 21, 23, 24].includes(k) ? "bg-[#14213d]" : "bg-transparent")} />
                      ))}
                    </div>

                  </div>
                </div>
              </article>

              <Feature n={2} icon={Video} title={t("f.proctor.t")} text={t("f.proctor.d")}>
                <div className="relative mx-auto aspect-[4/3] max-w-56 overflow-hidden rounded-lg bg-gradient-to-br from-[#25304f] to-[#0e1322] [--scan-distance:7.5rem]">
                  <div className="absolute inset-[18%] rounded-[40%] border-2 border-dashed border-emerald-300/80" />
                  <ScanFace className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/80" />
                  <div className="absolute inset-x-3 top-3 h-px animate-[scan_3.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-emerald-300 to-transparent" />
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">
                    <Check className="size-3" strokeWidth={3} /> {t("f.proctor.chip")}
                  </span>
                  <span className="absolute top-2 right-2 size-2.5 animate-pulse rounded-full bg-red-500" />
                </div>
              </Feature>

              <Feature n={3} icon={Target} title={t("f.goal.t")} text={t("f.goal.d")}>
                <div className="rounded-lg border border-dashed p-4">
                  <div className="flex justify-between text-xs font-bold text-muted-foreground">
                    <span>{t("f.goal.from")} · 96</span>
                    <span>{t("f.goal.to")} · 104</span>
                  </div>
                  <div className="relative mt-2 h-2.5 rounded-full bg-muted">
                    <div className="h-full w-[92%] rounded-full bg-primary" />
                    <div className="absolute top-1/2 right-0 h-5 w-1 -translate-y-1/2 rounded-full bg-pen" />
                  </div>
                  <p className="mt-1 text-right font-hand text-2xl leading-none text-pen">+8</p>
                </div>
              </Feature>

              <Feature n={4} icon={Trophy} title={t("f.league.t")} text={t("f.league.d")}>
                <ol className="divide-y divide-dashed rounded-lg border text-sm">
                  {[
                    { n: 1, name: "Аружан", xp: 940 },
                    { n: 2, name: t("f.league.you"), xp: 905, you: true },
                    { n: 3, name: "Нұрсұлтан", xp: 880 },
                  ].map((row) => (
                    <li key={row.n} className={cn("flex items-center gap-3 px-3 py-2", row.you && "bg-secondary font-extrabold text-primary")}>
                      <span className="w-4 font-serif font-bold tabular-nums">{row.n}</span>
                      <span className="flex-1 font-semibold">{row.name}</span>
                      <span className="font-bold tabular-nums">{row.xp} XP</span>
                    </li>
                  ))}
                </ol>
              </Feature>

              <Feature n={5} icon={CalendarCheck} title={t("f.plan.t")} text={t("f.plan.d")}>
                <ul className="space-y-2 text-sm">
                  {(["p1", "p2", "p3"] as const).map((k, i) => (
                    <li key={k} className="flex items-center gap-2.5 border-b border-dashed pb-2 last:border-0 last:pb-0">
                      <span className="relative grid size-5 place-items-center rounded-[4px] border-2 border-foreground/30">
                        {i < 2 && <PenCheck className="absolute -top-1.5 left-0 h-5 w-6" delay={0.2 + i * 0.2} />}
                      </span>
                      <span className={cn(i < 2 && "text-muted-foreground line-through decoration-pen/60")}>{t(`plan.${k}`)}</span>
                    </li>
                  ))}
                </ul>
              </Feature>

              <Feature n={6} icon={Flame} title={t("f.streak.t")} text={t("f.streak.d")} className="md:col-span-2">
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
                  {days.map((day, i) => {
                    const done = i < 5;
                    const today = i === 5;
                    return (
                      <div key={day} className="flex flex-col items-center gap-1.5">
                        <span
                          className={cn(
                            "grid size-10 place-items-center rounded-lg sm:size-12",
                            done ? "bg-streak text-white" : today ? "animate-pulse border-2 border-dashed border-streak text-streak" : "border border-dashed text-muted-foreground/40",
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

              <Feature n={7} icon={RotateCcw} title={t("f.mistakes.t")} text={t("f.mistakes.d")} className="md:col-span-2 lg:col-span-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  <span className="flex items-center gap-1.5 rounded-md bg-danger/10 px-2.5 py-1.5 text-danger">
                    <CircleX className="size-4" /> {t("f.mistakes.wrong")}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span className="flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-primary">
                    <Lightbulb className="size-4" /> {t("f.mistakes.explain")}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span className="flex items-center gap-1.5 rounded-md bg-success/12 px-2.5 py-1.5 text-success">
                    <CircleCheck className="size-4" /> {t("f.mistakes.right")}
                  </span>
                </div>
              </Feature>
            </div>
          </div>
        </section>

        {/* ================= Жиі қойылатын сұрақтар ================= */}
        <section className="mx-auto max-w-3xl px-4 py-20 lg:px-8" aria-labelledby="faq">
          <h2 id="faq" className="reveal text-2xl font-bold tracking-tight sm:text-4xl">
            {t("faqTitle")}
          </h2>
          <div className="mt-8 divide-y border-y">
            {faq.map((item, i) => (
              <details key={item.q} className="reveal group py-4 sm:py-5">
                <summary className="flex cursor-pointer list-none items-start gap-4 font-bold [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className="w-6 shrink-0 font-serif text-pen tabular-nums">
                    {i + 1}.
                  </span>
                  <h3 className="flex-1">{item.q}</h3>
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border text-primary transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 pl-10 text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ================= Соңғы шақыру ================= */}
        <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-8">
          <div className="reveal relative isolate overflow-hidden rounded-2xl bg-brand-gradient px-6 py-14 text-center text-white shadow-brand sm:px-12 sm:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:24px_24px]"
            />
            <Stamp label={t("stamp")} sub={t("stampSub")} rotate={14} className="absolute -top-4 -right-4 hidden size-32 text-[#ff8466] opacity-70 mix-blend-normal sm:grid" />
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/75">{t("ctaText")}</p>
            <Link
              href="/signup"
              className="group mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-[#fffdf8] px-7 text-lg font-extrabold text-[#14213d] shadow-[4px_4px_0_#ff8466] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#ff8466]"
            >
              {t("start")}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter locale={locale} />
    </div>
  );
}
