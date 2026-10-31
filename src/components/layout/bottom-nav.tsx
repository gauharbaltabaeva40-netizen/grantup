"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isNavActive, mainNav } from "@/config/nav";
import { cn } from "@/lib/utils";

export function BottomNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      aria-label={t("main")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg",
        className,
      )}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {mainNav.map(({ href, labelKey, icon: Icon, also }) => {
          const active = isNavActive(pathname, { href, also });
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] leading-tight font-semibold text-muted-foreground outline-none focus-visible:bg-accent",
                  active && "text-primary",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-secondary",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                <span className="max-w-full truncate px-0.5">{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
