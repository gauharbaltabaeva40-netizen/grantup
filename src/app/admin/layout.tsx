import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isAdminDemo } from "@/lib/admin/server";
import { getCurrentProfile } from "@/lib/auth/session";

// Жеке беттер іздеу жүйелерінде көрсетілмейді
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Админ-панель. Қорғау: middleware (кіру + құрылғы) → осы layout (рөл) → әр бетте adminPage()
// → әр action ішінде requireAdmin() → RLS. Жаңа бөлімдердің интерфейсі тек қазақша.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAdminDemo) {
    const profile = await getCurrentProfile();
    if (profile?.role !== "admin") notFound();
  }

  const t = await getTranslations("admin");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo size={30} showText={false} />
          <span className="font-extrabold">{t("title")}</span>
          <div className="ml-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 pb-3">
          <AdminNav />
          <Link href="/" className="ml-auto flex shrink-0 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">{t("back")}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {isAdminDemo && (
          <p className="mb-5 rounded-2xl bg-streak/10 px-4 py-3 text-sm font-semibold text-streak">
            Демо режим: Supabase кілттері қойылмаған — деректер бос, сақтау жұмыс істемейді.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
