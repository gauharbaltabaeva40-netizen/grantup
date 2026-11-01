import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Админ-панельдің ортақ қарапайым элементтері (сервер компоненттері).

export function AdminHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl bg-card p-5 shadow-soft", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-extrabold tabular-nums", tone === "warn" && "text-danger", tone === "ok" && "text-success")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Беттеу: ?page=N (басқа іздеу параметрлері сақталады) */
export function Pager({ page, hasNext, params, basePath }: { page: number; hasNext: boolean; params: Record<string, string | undefined>; basePath: string }) {
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${q.toString()}`;
  };
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold hover:bg-muted">
          <ChevronLeft className="size-4" aria-hidden /> Алдыңғы
        </Link>
      )}
      <span className="text-muted-foreground">{page}-бет</span>
      {hasNext && (
        <Link href={href(page + 1)} className="flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold hover:bg-muted">
          Келесі <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

export const inputClass = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
export const textareaClass = "w-full rounded-xl border border-input bg-card px-3 py-2 font-mono text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
