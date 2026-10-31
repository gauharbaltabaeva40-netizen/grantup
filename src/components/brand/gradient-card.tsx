import { cn } from "@/lib/utils";

export function GradientCard({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-brand-gradient p-5 text-white shadow-brand sm:p-6",
        className,
      )}
      {...props}
    >
      {/* Жұмсақ сәндік дөңгелектер */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-white/15 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 -z-10 size-56 rounded-full bg-[#7b3ff2]/40 blur-3xl" />
      {children}
    </div>
  );
}
