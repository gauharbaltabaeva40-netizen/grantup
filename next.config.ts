import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Базалық қауіпсіздік тақырыптары. Толық CSP 11-кезеңде (контентті қорғау) қосылады.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Админ сұрақ суретін (≤ 2 МБ) және импорт жолдарын Server Action арқылы жібереді
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // Метадеректерді (title, description) әрдайым <head>-ке жазу: generateMetadata жылдам (тек аударма),
  // ал ағынмен (streaming) берілсе, кейбір сканерлер мен превью жасаушылар сипаттаманы көрмейді.
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Service worker әрдайым жаңа нұсқада жүктелсін
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
