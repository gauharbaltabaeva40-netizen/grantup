import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { kk: `${siteUrl}/`, ru: `${siteUrl}/ru` };
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1, alternates: { languages } },
    { url: `${siteUrl}/ru`, changeFrequency: "weekly", priority: 0.9, alternates: { languages } },
    {
      url: `${siteUrl}/ubt-2026`,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: { languages: { kk: `${siteUrl}/ubt-2026`, ru: `${siteUrl}/ru/ubt-2026` } },
    },
    {
      url: `${siteUrl}/ru/ubt-2026`,
      changeFrequency: "monthly",
      priority: 0.8,
      alternates: { languages: { kk: `${siteUrl}/ubt-2026`, ru: `${siteUrl}/ru/ubt-2026` } },
    },
    { url: `${siteUrl}/signup`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
