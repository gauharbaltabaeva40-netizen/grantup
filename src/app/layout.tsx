import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
import { siteUrl } from "@/lib/env";
import "./globals.css";

// Manrope: кириллица + қазақ әріптері (ә ғ қ ң ө ұ ү һ і) cyrillic-ext ішінде
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");

  return {
    metadataBase: new URL(siteUrl),
    title: { default: t("title"), template: "%s · GrantUp" },
    description: t("description"),
    applicationName: "GrantUp",
    appleWebApp: { capable: true, title: "GrantUp", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8ff" },
    { media: "(prefers-color-scheme: dark)", color: "#070b1a" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, nonce] = await Promise.all([getLocale(), headers().then((h) => h.get("x-nonce") ?? undefined)]);

  return (
    <html lang={locale} className={manrope.variable} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          <Providers nonce={nonce}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
