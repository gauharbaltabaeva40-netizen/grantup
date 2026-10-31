export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
