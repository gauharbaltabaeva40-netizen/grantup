import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-10 text-center shadow-soft",
        className,
      )}
    >
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
        <Icon className="size-7" aria-hidden />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-6 w-full sm:w-auto">{action}</div>}
    </div>
  );
}
