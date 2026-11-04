import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { WatermarkProvider } from "@/components/protection/protection";
import { getCurrentProfile } from "@/lib/auth/session";
import { getWatermarkText } from "@/lib/security/watermark";

// Жеке беттер іздеу жүйелерінде көрсетілмейді
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Әкімші уақытша құпиясөз берген болса — алдымен өз құпиясөзін қояды
  if ((await getCurrentProfile())?.must_change_password) redirect("/change-password");
  return (
    <WatermarkProvider mark={await getWatermarkText()}>
    <div className="relative isolate min-h-dvh">
      <div aria-hidden className="absolute -top-40 left-1/2 -z-10 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
      <header className="mx-auto flex h-16 w-full max-w-2xl items-center gap-2 px-4 pt-[env(safe-area-inset-top)]">
        <Logo size={34} href="#" className="pointer-events-none" />
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-12">{children}</main>
    </div>
    </WatermarkProvider>
  );
}
