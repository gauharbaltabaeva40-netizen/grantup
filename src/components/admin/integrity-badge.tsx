import { integrityTone } from "@/lib/proctoring/integrity";
import { cn } from "@/lib/utils";

const TONE = {
  good: "bg-success/15 text-success",
  warn: "bg-streak/15 text-amber-700 dark:text-amber-300",
  bad: "bg-danger/12 text-danger",
  none: "bg-muted text-muted-foreground",
} as const;

/** Адалдық индексі (тек әкімшіге): 90+ жасыл, 70–89 сары, 70-тен төмен қызыл */
export function IntegrityBadge({ index, className }: { index: number | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums", TONE[integrityTone(index)], className)}>
      {index === null ? "Камерасыз" : `Адалдық ${index}`}
    </span>
  );
}
