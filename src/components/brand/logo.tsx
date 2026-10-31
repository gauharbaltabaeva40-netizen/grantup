import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  showText?: boolean;
  href?: string;
  className?: string;
};

export function Logo({ size = 36, showText = true, href = "/", className }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label="GrantUp"
      className={cn("inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}
    >
      <Image src="/logo.png" alt="" width={size} height={size} priority className="shrink-0 rounded-full" />
      {showText && (
        <span className="text-lg font-extrabold tracking-tight">
          Grant<span className="text-brand-gradient">Up</span>
        </span>
      )}
    </Link>
  );
}
