"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { isNavActive, mainNav, type NavItem, secondaryNav } from "@/config/nav";
import { cn } from "@/lib/utils";

function SidebarLink({ item, active, small }: { item: NavItem; active: boolean; small?: boolean }) {
  const t = useTranslations("nav");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 font-semibold text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        small ? "h-10 text-sm" : "h-12 text-[15px]",
        // Белсенді пункт: сол жақта қызыл қалам белгісі
        active && "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2.5 before:-left-4 before:w-[3px] before:rounded-r-full before:bg-pen",
      )}
    >
      <Icon className={cn(small ? "size-4" : "size-5", active && "text-primary")} strokeWidth={active ? 2.4 : 2} aria-hidden />
      {t(item.labelKey)}
    </Link>
  );
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  // Қосымша пункттерден ең нақты сәйкесін белсенді етеміз (/practice/mistakes ≠ /practice)
  const activeSecondary = secondaryNav
    .filter((item) => isNavActive(pathname, { href: item.href }))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className={cn("flex-col border-r border-sidebar-border bg-sidebar px-4 py-6", className)}>
      <Logo className="mb-8 px-2" />
      <nav aria-label={t("main")} className="flex flex-col gap-1">
        {mainNav.map((item) => (
          <SidebarLink key={item.href} item={item} active={!activeSecondary && isNavActive(pathname, { href: item.href })} />
        ))}
        <div className="my-3 border-t border-sidebar-border" />
        {secondaryNav.map((item) => (
          <SidebarLink key={item.href} item={item} active={item.href === activeSecondary} small />
        ))}
      </nav>
    </aside>
  );
}
