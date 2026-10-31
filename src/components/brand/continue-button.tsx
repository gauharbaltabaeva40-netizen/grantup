import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContinueButtonProps = {
  href: string;
  children: React.ReactNode;
  /** `brand` — ашық фонда, `white` — градиент карта ішінде */
  tone?: "brand" | "white";
  className?: string;
};

/** «Келесі не істеймін?» — әр экрандағы басты әрекет батырмасы. */
export function ContinueButton({ href, children, tone = "brand", className }: ContinueButtonProps) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: tone, size: "2xl" }), "w-full sm:w-auto", className)}>
      {children}
      <ArrowRight aria-hidden />
    </Link>
  );
}
