import { Flame, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  streak: { icon: Flame, className: "bg-streak/12 text-streak", iconClass: "fill-streak/30" },
  xp: { icon: Zap, className: "bg-brand/10 text-brand", iconClass: "fill-brand/25" },
  level: { icon: Star, className: "bg-brand-violet/12 text-brand-violet", iconClass: "fill-brand-violet/25" },
} as const;

type StatPillProps = {
  variant: keyof typeof variants;
  value: number | string;
  label: string;
  className?: string;
};

/** Streak / XP / деңгей көрсеткіші. `label` экран оқу құралдары үшін. */
export function StatPill({ variant, value, label, className }: StatPillProps) {
  const { icon: Icon, className: tone, iconClass } = variants[variant];

  return (
    <span
      title={label}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold tabular-nums", tone, className)}
    >
      <Icon className={cn("size-4", iconClass)} aria-hidden />
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}
