import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isSupabaseConfigured } from "@/lib/env";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth");

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center gap-2 px-4 pt-[env(safe-area-inset-top)]">
        <Logo size={34} />
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        {!isSupabaseConfigured && (
          <p className="mb-4 rounded-xl bg-streak/12 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">
            {t("demoNotice")}
          </p>
        )}
        <div className="relative rounded-2xl border bg-card p-6 pl-10 shadow-soft sm:p-8 sm:pl-14">
          {/* Дәптердің қызыл шет сызығы */}
          <div aria-hidden className="absolute inset-y-0 left-5 w-px bg-pen/35 sm:left-8" />
          {children}
        </div>
      </main>
    </div>
  );
}
