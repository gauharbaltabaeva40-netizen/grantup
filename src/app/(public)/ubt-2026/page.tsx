import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { PublicShell } from "@/components/public/public-shell";
import { GUIDE } from "@/content/ubt-guide";
import type { Locale } from "@/i18n/config";
import { siteUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

const PATH = "/ubt-2026";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const g = GUIDE[locale];
  return {
    title: { absolute: `${g.title} | GrantUp` },
    description: g.description,
    alternates: { canonical: locale === "ru" ? `/ru${PATH}` : PATH, languages: { kk: PATH, ru: `/ru${PATH}`, "x-default": PATH } },
    openGraph: {
      type: "article",
      title: g.title,
      description: g.description,
      url: locale === "ru" ? `/ru${PATH}` : PATH,
      siteName: "GrantUp",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: g.title }],
    },
  };
}

// Ашық SEO беті: ҰБТ-2026 құрылымы (оқушылар іздейтін сұрақтарға жауап) + платформаға шақыру
export default async function UbtGuidePage() {
  const locale = (await getLocale()) as Locale;
  const g = GUIDE[locale];
  const url = `${siteUrl}${locale === "ru" ? "/ru" : ""}${PATH}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: g.title,
        description: g.description,
        inLanguage: locale,
        url,
        image: `${siteUrl}/og.png`,
        publisher: { "@type": "Organization", name: "GrantUp", logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` } },
      },
      {
        "@type": "FAQPage",
        inLanguage: locale,
        mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };

  return (
    <PublicShell locale={locale} path={PATH}>
      {/* JSON-LD — дерек блогы, орындалмайды */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-4xl px-4 py-10 lg:py-14">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">{g.h1}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{g.lead}</p>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {g.facts.map((f) => (
            <div key={f.label} className="rounded-2xl bg-card p-4 shadow-soft">
              <dt className="sr-only">{f.label}</dt>
              <dd>
                <span className="text-brand-gradient block text-4xl font-extrabold tabular-nums">{f.value}</span>
                <span className="text-sm font-semibold text-muted-foreground">{f.label}</span>
              </dd>
            </div>
          ))}
        </dl>

        <section className="mt-12" aria-labelledby="structure">
          <h2 id="structure" className="text-2xl font-extrabold tracking-tight">{g.structureTitle}</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl bg-card shadow-soft">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-muted/70 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">{g.colSubject}</th>
                  <th scope="col" className="px-4 py-3 text-center font-bold">{g.colQuestions}</th>
                  <th scope="col" className="px-4 py-3 text-center font-bold">{g.colPoints}</th>
                  <th scope="col" className="px-4 py-3 font-bold">{g.colTypes}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {g.subjects.map((s) => (
                  <tr key={s.name}>
                    <th scope="row" className="px-4 py-3 text-left font-semibold">
                      {s.name}
                      <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold", s.mandatory ? "bg-secondary text-primary" : "bg-brand-violet/10 text-brand-violet dark:text-[#b69bff]")}>
                        {s.mandatory ? g.mandatory : g.profile}
                      </span>
                    </th>
                    <td className="px-4 py-3 text-center tabular-nums">{s.questions}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{s.points}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.types}</td>
                  </tr>
                ))}
                <tr className="bg-secondary/50 font-extrabold">
                  <th scope="row" className="px-4 py-3 text-left">{g.total}</th>
                  <td className="px-4 py-3 text-center">120</td>
                  <td className="px-4 py-3 text-center">140</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <section aria-labelledby="scoring">
            <h2 id="scoring" className="text-2xl font-extrabold tracking-tight">{g.scoringTitle}</h2>
            <ul className="mt-4 space-y-2.5">
              {g.scoring.map((s) => (
                <li key={s} className="flex gap-2.5 text-[15px] leading-relaxed">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="difficulty">
            <h2 id="difficulty" className="text-2xl font-extrabold tracking-tight">{g.difficultyTitle}</h2>
            <p className="mt-4 text-[15px] leading-relaxed">{g.difficulty}</p>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden>
              <span className="w-1/2 bg-emerald-500" />
              <span className="w-[30%] bg-amber-400" />
              <span className="w-1/5 bg-red-500" />
            </div>
          </section>
        </div>

        <section className="mt-12" aria-labelledby="prep">
          <h2 id="prep" className="text-2xl font-extrabold tracking-tight">{g.prepTitle}</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {g.prep.map((p, i) => (
              <li key={p.t} className="rounded-2xl bg-card p-4 shadow-soft">
                <span className="text-brand-gradient text-2xl font-extrabold">{i + 1}</span>
                <h3 className="mt-1 font-bold">{p.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="text-2xl font-extrabold tracking-tight">{g.faqTitle}</h2>
          <div className="mt-4 space-y-2.5">
            {g.faq.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-card p-4 shadow-soft">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">
                  <h3>{f.q}</h3>
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-primary transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="relative isolate mt-12 overflow-hidden rounded-[2rem] bg-[#070b1a] px-6 py-10 text-center text-white">
          <div aria-hidden className="pointer-events-none absolute -top-20 left-1/4 -z-10 size-72 rounded-full bg-[#0a84ff]/30 blur-3xl" />
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{g.ctaTitle}</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/70">{g.ctaText}</p>
          <Link href="/signup" className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 font-extrabold text-[#070b1a] transition-transform hover:-translate-y-0.5">
            {g.cta} <ArrowRight className="size-5" aria-hidden />
          </Link>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">{g.source}</p>
      </article>
    </PublicShell>
  );
}
