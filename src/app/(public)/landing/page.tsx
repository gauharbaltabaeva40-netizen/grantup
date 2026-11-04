import type { Metadata } from "next";
import Image from "next/image";
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
  Swords,
  Target,
  Trophy,
  Video,
} from "lucide-react";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

// Ашық басты бет (кірмеген адамдар мен іздеу жүйелері үшін).
// Middleware «/» → қазақша, «/ru» → орысша нұсқасын осы бетке rewrite жасайды.
// Құрылымы: қараңғы «премиум» бірінші экран (тіркелу сілтемесі + дуэль көрінісі) → 7 ерекшелік → FAQ → шақыру.

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
    <article
      className={cn(
        "reveal hover-lift group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-black/[0.04] bg-card p-6 shadow-soft dark:border-white/[0.06]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-md ring-1 ring-white/20", tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="text-lg leading-tight font-extrabold tracking-tight">{title}</h3>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{text}</p>
      <div className="mt-auto pt-6" aria-hidden>
        {children}
      </div>
    </article>
  );
}

/** Бірінші экрандағы жүзіп тұрған белгі */
function FloatChip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white shadow-xl backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
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

      {/* ================= Қараңғы бірінші экран ================= */}
      <div className="relative isolate overflow-hidden rounded-b-[2.5rem] bg-[#070b1a] text-white sm:rounded-b-[3.5rem]">
        {/* Тор өрнегі + жарық дақтар */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />
        <div aria-hidden className="pointer-events-none absolute -top-48 -left-40 -z-10 size-[38rem] animate-[float_14s_ease-in-out_infinite] rounded-full bg-[#0a84ff]/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-40 -z-10 size-[34rem] animate-[float_12s_ease-in-out_infinite_reverse] rounded-full bg-[#7b3ff2]/35 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/3 -z-10 size-[28rem] rounded-full bg-[#ef4444]/15 blur-3xl" />

        <header className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 pt-[env(safe-area-inset-top)] lg:px-8">
          <Link href={PATH[locale]} aria-label="GrantUp" className="inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-white/50">
            <Image src="/logo.png" alt="" width={34} height={34} priority className="rounded-full" />
            <span className="text-lg font-extrabold tracking-tight">
              Grant<span className="bg-gradient-to-r from-[#7dd3fc] to-[#c4b5fd] bg-clip-text text-transparent">Up</span>
            </span>
          </Link>
          <nav aria-label={t("lang")} className="ml-auto flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-xs font-bold backdrop-blur">
            {locales.map((l) => (
              <a
                key={l}
                href={PATH[l]}
                hrefLang={l}
                aria-current={l === locale ? "true" : undefined}
                className={cn("rounded-full px-2.5 py-1.5 transition-colors", l === locale ? "bg-white text-[#070b1a]" : "text-white/70 hover:text-white")}
              >
                {localeLabels[l].short}
              </a>
            ))}
          </nav>
          <Link href="/login" className="h-10 rounded-full px-4 text-sm leading-10 font-bold text-white/85 transition-colors hover:text-white">
            {t("login")}
          </Link>
        </header>

        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-8 pb-20 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-16 lg:pb-28">
          <div>
            <p className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-bold text-white/85 backdrop-blur">
              <Sparkles className="size-4 shrink-0 text-amber-300" aria-hidden />
              {t("badge")}
              <span className="hidden text-white/55 sm:inline">· {t("formatLine")}</span>
            </p>
            <h1 className="text-[2.6rem] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance sm:text-6xl lg:text-[4.1rem]">
              {t("h1a")}{" "}
              <span className="bg-gradient-to-r from-[#7dd3fc] via-[#a5b4fc] to-[#f0abfc] bg-clip-text text-transparent">{t("h1b")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">{t("lead")}</p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/signup"
                className="group inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-7 text-lg font-extrabold text-[#070b1a] shadow-[0_12px_40px_-12px_rgba(125,211,252,0.6)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
              >
                {t("start")}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 text-lg font-bold text-white backdrop-blur transition-colors hover:bg-white/10"
              >
                {t("login")}
              </Link>
            </div>
            <p className="mt-6 text-[15px] text-white/60">
              {t("signupLine")}{" "}
              <Link href="/signup" className="font-bold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                {t("signupLink")} →
              </Link>
            </p>
            <p className="mt-3 text-xs font-semibold tracking-wide text-white/40 uppercase">{t("heroNote")}</p>
          </div>

          {/* Көрініс: дуэль + жүзіп тұрған белгілер */}
          <div className="relative mx-auto w-full max-w-md py-8" aria-hidden>
            <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between text-xs font-bold text-white/60">
                <span className="flex items-center gap-1.5">
                  <Swords className="size-4 text-orange-300" /> {t("show.duelTitle")}
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-2 py-0.5 text-red-200">
                  <span className="size-1.5 animate-pulse rounded-full bg-red-400" /> {t("show.live")}
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="flex flex-col items-center gap-2">
                  <span className="grid size-16 place-items-center rounded-full bg-white/10 text-3xl ring-2 ring-sky-300/70">🦊</span>
                  <span className="text-sm font-extrabold">{t("show.you")}</span>
                </div>
                <div className="text-center">
                  <p className="text-5xl font-extrabold tabular-nums">
                    3<span className="mx-1 text-white/30">:</span>2
                  </p>
                  <p className="mt-1 text-xs font-semibold text-white/55">{t("show.q")}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span className="grid size-16 place-items-center rounded-full bg-white/10 text-3xl ring-2 ring-fuchsia-300/60">🐼</span>
                  <span className="text-sm font-extrabold">{t("show.rival")}</span>
                </div>
              </div>

              <div className="mt-5 flex gap-1.5">
                {[true, true, false, null, null].map((m, i) => (
                  <span key={i} className={cn("h-2 flex-1 rounded-full", m === true ? "bg-emerald-400" : m === false ? "bg-red-400" : i === 3 ? "animate-pulse bg-white" : "bg-white/15")} />
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {["A", "B", "C"].map((letter, i) => (
                  <div
                    key={letter}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                      i === 1 ? "border-emerald-400/60 bg-emerald-400/15" : "border-white/10 bg-white/[0.04]",
                    )}
                  >
                    <span className={cn("grid size-6 place-items-center rounded-full text-xs font-bold", i === 1 ? "bg-emerald-400 text-[#070b1a]" : "bg-white/10")}>
                      {i === 1 ? <Check className="size-3.5" strokeWidth={3} /> : letter}
                    </span>
                    <span className={cn("h-2 rounded-full", i === 1 ? "w-28 bg-white/70" : "w-20 bg-white/25")} />
                  </div>
                ))}
              </div>
            </div>

            <FloatChip className="-top-1 -left-3 animate-[float_7s_ease-in-out_infinite] sm:-left-10">
              <Flame className="size-4 text-orange-300" /> {t("show.streak")}
            </FloatChip>
            <FloatChip className="-top-1 -right-3 animate-[float_9s_ease-in-out_infinite_reverse] sm:-right-10">
              <ScanFace className="size-4 text-emerald-300" /> {t("show.camera")}
              <Check className="size-3.5 text-emerald-300" strokeWidth={3} />
            </FloatChip>
            <FloatChip className="-bottom-2 left-1/2 -translate-x-1/2 animate-[float_8s_ease-in-out_infinite] whitespace-nowrap">
              <Trophy className="size-4 text-amber-300" /> {t("show.league")}
            </FloatChip>
          </div>
        </section>
      </div>

      <main>
        {/* ================= Ерекшеліктер ================= */}
        <section className="mx-auto max-w-6xl px-4 py-20 lg:px-8 lg:py-28" aria-labelledby="features">
          <div className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-extrabold tracking-[0.18em] text-primary uppercase">{t("featuresKicker")}</p>
            <h2 id="features" className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">{t("featuresTitle")}</h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">{t("featuresLead")}</p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Дуэль — үлкен карта */}
            <article className="reveal hover-lift relative isolate flex flex-col overflow-hidden rounded-[1.75rem] bg-[#0b1026] p-6 text-white shadow-brand md:col-span-2">
              <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 -z-10 size-72 animate-[float_11s_ease-in-out_infinite] rounded-full bg-[#7b3ff2]/45 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 -z-10 size-64 rounded-full bg-[#0a84ff]/35 blur-3xl" />
              <div className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#fb923c] to-[#ef4444] shadow-md">
                  <Swords className="size-5" aria-hidden />
                </span>
                <h3 className="text-xl font-extrabold tracking-tight">{t("f.duel.t")}</h3>
                <span className="ml-auto hidden rounded-full bg-amber-300 px-2.5 py-1 text-xs font-extrabold text-[#0b1026] sm:inline">{t("f.duel.chip")}</span>
              </div>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/75">{t("f.duel.d")}</p>
              <div className="mt-auto pt-8" aria-hidden>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
                  {[
                    { e: "🦊", n: t("show.you"), m: [true, true, false, true, true] },
                    null,
                    { e: "🐼", n: t("show.rival"), m: [true, false, true, false, true] },
                  ].map((p, i) =>
                    p ? (
                      <div key={i} className={cn("flex flex-col gap-3", i === 2 && "items-end")}>
                        <span className={cn("flex items-center gap-2 font-extrabold", i === 2 && "flex-row-reverse")}>
                          <span className="grid size-10 place-items-center rounded-full bg-white/10 text-xl">{p.e}</span>
                          {p.n}
                        </span>
                        <span className="flex gap-1">
                          {p.m.map((ok, k) => (
                            <span key={k} className={cn("grid size-6 place-items-center rounded-md", ok ? "bg-emerald-500/90" : "bg-red-500/80")}>
                              {ok ? <Check className="size-3.5" strokeWidth={3} /> : <CircleX className="size-3.5" />}
                            </span>
                          ))}
                        </span>
                      </div>
                    ) : (
                      <span key={i} className="text-3xl font-extrabold tabular-nums">
                        4<span className="mx-1 text-white/30">:</span>3
                      </span>
                    ),
                  )}
                </div>
              </div>
            </article>

            <Feature icon={Video} tone="bg-gradient-to-br from-[#0a84ff] to-[#0047ff]" title={t("f.proctor.t")} text={t("f.proctor.d")}>
              <div className="relative mx-auto aspect-[4/3] max-w-56 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 [--scan-distance:7.5rem]">
                <div className="absolute inset-[18%] rounded-[40%] border-2 border-dashed border-emerald-400/80" />
                <ScanFace className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/80" />
                <div className="absolute inset-x-3 top-3 h-px animate-[scan_3.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_12px_2px_rgba(110,231,183,0.6)]" />
                <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">
                  <Check className="size-3" strokeWidth={3} /> {t("f.proctor.chip")}
                </span>
                <span className="absolute top-2 right-2 size-2.5 animate-pulse rounded-full bg-red-500" />
              </div>
            </Feature>

            <Feature icon={Target} tone="bg-gradient-to-br from-[#22c55e] to-[#0e9f6e]" title={t("f.goal.t")} text={t("f.goal.d")}>
              <div className="rounded-2xl bg-muted/60 p-4">
                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                  <span>{t("f.goal.from")} · 96</span>
                  <span>{t("f.goal.to")} · 104</span>
                </div>
                <div className="relative mt-2 h-3 rounded-full bg-background">
                  <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-[#22c55e] to-[#0e9f6e]" />
                  <div className="absolute top-1/2 right-0 h-5 w-1 -translate-y-1/2 rounded-full bg-foreground" />
                </div>
                <p className="mt-2 text-right text-sm font-extrabold text-success">+8</p>
              </div>
            </Feature>

            <Feature icon={Trophy} tone="bg-gradient-to-br from-[#f59e0b] to-[#ea580c]" title={t("f.league.t")} text={t("f.league.d")}>
              <ol className="space-y-1.5 text-sm">
                {[
                  { n: 1, name: "Аружан", xp: 940 },
                  { n: 2, name: t("f.league.you"), xp: 905, you: true },
                  { n: 3, name: "Нұрсұлтан", xp: 880 },
                ].map((row) => (
                  <li key={row.n} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", row.you ? "bg-[#0047ff] text-white" : "bg-muted/60")}>
                    <span className="w-4 font-extrabold tabular-nums">{row.n}</span>
                    <span className="flex-1 font-semibold">{row.name}</span>
                    <span className="font-bold tabular-nums">{row.xp} XP</span>
                  </li>
                ))}
              </ol>
            </Feature>

            <Feature icon={CalendarCheck} tone="bg-gradient-to-br from-[#7b3ff2] to-[#4f46e5]" title={t("f.plan.t")} text={t("f.plan.d")}>
              <ul className="space-y-2 rounded-2xl bg-muted/60 p-3.5 text-sm">
                {(["p1", "p2", "p3"] as const).map((k, i) => (
                  <li key={k} className="flex items-center gap-2.5">
                    <span className={cn("grid size-5 place-items-center rounded-md", i < 2 ? "bg-brand-violet text-white" : "border-2 border-border")}>
                      {i < 2 && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    {t(`plan.${k}`)}
                  </li>
                ))}
              </ul>
            </Feature>

            <Feature icon={Flame} tone="bg-gradient-to-br from-[#fb923c] to-[#ef4444]" title={t("f.streak.t")} text={t("f.streak.d")} className="md:col-span-2">
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
                            ? "bg-gradient-to-br from-[#fb923c] to-[#ef4444] text-white shadow-[0_6px_16px_-6px_rgba(239,68,68,0.7)]"
                            : today
                              ? "animate-pulse border-2 border-dashed border-[#fb923c] text-[#fb923c]"
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


            <Feature icon={RotateCcw} tone="bg-gradient-to-br from-[#ef4444] to-[#db2777]" title={t("f.mistakes.t")} text={t("f.mistakes.d")} className="md:col-span-2 lg:col-span-1">
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

        {/* ================= Жиі қойылатын сұрақтар ================= */}
        <section className="mx-auto max-w-3xl px-4 pb-20 lg:px-8" aria-labelledby="faq">
          <h2 id="faq" className="reveal text-center text-2xl font-extrabold tracking-tight sm:text-4xl">{t("faqTitle")}</h2>
          <div className="mt-8 space-y-2.5">
            {faq.map((item) => (
              <details key={item.q} className="reveal group rounded-2xl border border-black/[0.04] bg-card p-4 shadow-soft sm:p-5 dark:border-white/[0.06]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                  <h3>{item.q}</h3>
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ================= Соңғы шақыру ================= */}
        <section className="mx-auto max-w-6xl px-4 pb-16 lg:px-8">
          <div className="reveal relative isolate overflow-hidden rounded-[2.5rem] bg-[#070b1a] px-6 py-14 text-center text-white shadow-brand sm:px-12 sm:py-16">
            <div aria-hidden className="pointer-events-none absolute -top-24 left-1/4 -z-10 size-80 animate-[float_12s_ease-in-out_infinite] rounded-full bg-[#0a84ff]/30 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-28 -z-10 size-80 rounded-full bg-[#7b3ff2]/35 blur-3xl" />
            <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">{t("ctaText")}</p>
            <Link
              href="/signup"
              className="group mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-7 text-lg font-extrabold text-[#070b1a] transition-transform hover:-translate-y-0.5"
            >
              {t("start")}
              <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row lg:px-8">
          <span className="font-extrabold text-foreground">GrantUp.kz</span>
          <span>{t("footer")}</span>
          <span className="sm:ml-auto">© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
