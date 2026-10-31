"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/devices", key: "devices", icon: Smartphone },
  { href: "/admin/access", key: "access", icon: KeyRound },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("admin.nav");

  return (
    <nav className="flex gap-2">
      {items.map(({ href, key, icon: Icon }) => {
        const active = pathname.startsWith(href);
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
