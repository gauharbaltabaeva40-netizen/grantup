import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { StatPill } from "@/components/brand/stat-pill";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { demoStudent } from "@/lib/demo";

export async function TopBar() {
  const t = await getTranslations("common");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4 lg:px-8">
        <Logo size={32} showText={false} className="lg:hidden" />
        <div className="ml-auto flex items-center gap-1.5">
          <StatPill variant="streak" value={demoStudent.streak} label={t("streak")} />
          <StatPill variant="xp" value={demoStudent.xp} label={t("xp")} />
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
