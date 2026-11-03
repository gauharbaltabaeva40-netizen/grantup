export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      <span aria-hidden className="mt-2 block h-1 w-12 rounded-full bg-brand-gradient" />
      {description && <p className="mt-1.5 text-[15px] text-muted-foreground sm:text-base">{description}</p>}
    </div>
  );
}
