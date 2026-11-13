import { cn } from "@/lib/utils";

/**
 * Басты «сия» картасы (бұрын — көк-күлгін градиент).
 * Қою көк сия фоны + өте әлсіз тор сызық + бұрышта қызыл қалам жиегі.
 */
export function GradientCard({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-2xl bg-brand-gradient p-5 text-white shadow-brand sm:p-6", className)}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:24px_24px]"
      />
      {/* Қызыл қалам: сол жақтағы «шет сызығы» (дәптердегідей) */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-3 -z-10 w-px bg-[#ff8466]/50" />
      {children}
    </div>
  );
}
