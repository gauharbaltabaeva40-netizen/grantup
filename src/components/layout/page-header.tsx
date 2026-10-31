export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-1.5 text-[15px] text-muted-foreground sm:text-base">{description}</p>}
    </div>
  );
}
