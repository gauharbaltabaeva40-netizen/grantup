import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookOpen, ChevronRight, ClipboardCheck, ListChecks, RotateCcw } from "lucide-react";
import { planItemHref, type PlanItem } from "@/lib/plan/types";

const icons = { lesson: BookOpen, practice: ListChecks, mistakes: RotateCcw, mock: ClipboardCheck } as const;
const tones = {
  lesson: "bg-secondary text-primary",
  practice: "bg-brand-violet/10 text-brand-violet",
  mistakes: "bg-danger/10 text-danger",
  mock: "bg-streak/12 text-streak",
} as const;

export async function PlanItemRow({ item }: { item: PlanItem }) {
  const t = await getTranslations("plan");
  const Icon = icons[item.type];
  return (
    <Link
      href={planItemHref(item)}
      className="flex items-center gap-3 rounded-xl p-2.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[item.type]}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{item.title}</span>
        <span className="text-xs text-muted-foreground">
          {t(`type.${item.type}`)}
          {item.questions ? ` · ${t("questions", { count: item.questions })}` : ""}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
