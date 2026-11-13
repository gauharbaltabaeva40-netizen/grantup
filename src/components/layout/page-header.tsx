export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {/* Қызыл қаламмен қысқа астын сызу */}
      <svg aria-hidden viewBox="0 0 60 8" fill="none" className="mt-1 h-2 w-14 text-pen">
        <path d="M2 5.5C14 3 30 2.5 58 4" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
      </svg>
      {description && <p className="mt-1.5 text-[15px] text-muted-foreground sm:text-base">{description}</p>}
    </div>
  );
}
