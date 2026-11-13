import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// Тек ашық беттер индекстеледі; жеке кабинет, админ, API жабық.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/ru", "/ru/", "/ubt-2026", "/privacy", "/terms", "/login", "/signup"],
      disallow: [
        "/admin",
        "/api/",
        "/auth/",
        "/device",
        "/exam/",
        "/onboarding",
        "/lessons",
        "/practice",
        "/mock-exam",
        "/plan",
        "/league",
        "/profile",
        "/upgrade",
        "/check-email",
        "/forgot-password",
        "/reset-password",
        "/styleguide",
        "/verify/",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
