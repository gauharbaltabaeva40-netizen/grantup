"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, ClipboardList, FileQuestion, KeyRound, LayoutDashboard, ScanFace, ScrollText, Settings, Smartphone, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/students", key: "students", icon: Users },
  { href: "/admin/access", key: "access", icon: KeyRound },
  { href: "/admin/devices", key: "devices", icon: Smartphone },
  { href: "/admin/content", key: "content", icon: BookOpen },
  { href: "/admin/questions", key: "questions", icon: FileQuestion },
  { href: "/admin/mocks", key: "mocks", icon: ClipboardList },
  { href: "/admin/proctoring", key: "proctoring", icon: ScanFace },
  { href: "/admin/settings", key: "settings", icon: Settings },
  { href: "/admin/security", key: "security", icon: ScrollText },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  return (
    <nav className="flex gap-2">
      {items.map(({ href, key, icon: Icon, ...rest }) => {
        const active = "exact" in rest ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted",
              active && "bg-secondary text-primary hover:bg-secondary",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
