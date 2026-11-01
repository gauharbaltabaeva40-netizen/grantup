// Нәтиже бетінің графиктері (серверде рендерленеді).
// Ережелер: бір серия — бір түс (primary), жіңішке бағандар (≤ 24px, ұшы 4px дөңгелек),
// мәндер мәтін түсімен, торлар білінбейтін; әр графикте кесте түрі бар.

import { cn } from "@/lib/utils";

/** Көлденең бағандар: әр жолда атау, баған және ұшында мән. */
export function BarList({
  rows,
  max,
  formatValue,
  ariaLabel,
}: {
  rows: { key: string; label: string; value: number; max?: number; hint?: string }[];
  max: number;
  formatValue: (row: { value: number; max?: number }) => string;
  ariaLabel: string;
}) {
  return (
    <ul className="space-y-4" aria-label={ariaLabel}>
      {rows.map((row) => {
        const rowMax = row.max ?? max;
        const pct = rowMax > 0 ? Math.min(100, (row.value / rowMax) * 100) : 0;
        return (
          <li key={row.key} title={`${row.label}: ${formatValue(row)}`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{row.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{formatValue(row)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-r-[4px] bg-secondary" role="presentation">
              <div className="h-full rounded-r-[4px] bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            {row.hint && <p className="mt-1 text-xs text-muted-foreground">{row.hint}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** Бір реңкті (көктің) реттік шкаласы: 0% — ашық, 100% — қанық. */
const HEAT_STEPS = [
  { min: 0, bg: "bg-primary/10", text: "text-foreground" },
  { min: 20, bg: "bg-primary/25", text: "text-foreground" },
  { min: 40, bg: "bg-primary/45", text: "text-foreground" },
  { min: 60, bg: "bg-primary/70", text: "text-white" },
  { min: 80, bg: "bg-primary", text: "text-white" },
];

function heatStep(percent: number) {
  return [...HEAT_STEPS].reverse().find((s) => percent >= s.min) ?? HEAT_STEPS[0];
}

/** Тақырыптар жылу картасы: пән бойынша топталған ұяшықтар, ішінде пайыз. */
export function TopicHeatmap({
  groups,
  legendLow,
  legendHigh,
}: {
  groups: { title: string; topics: { id: string; title: string; percent: number; correct: number; total: number }[] }[];
  legendLow: string;
  legendHigh: string;
}) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-2 text-sm font-bold">{group.title}</p>
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {group.topics.map((topic) => {
              const step = heatStep(topic.percent);
              return (
                <li
                  key={topic.id}
                  title={`${topic.title}: ${topic.percent}% (${topic.correct}/${topic.total})`}
                  className={cn("flex min-h-16 flex-col justify-between rounded-xl p-2.5", step.bg, step.text)}
                >
                  <span className="line-clamp-2 text-xs leading-tight font-semibold">{topic.title}</span>
                  <span className="text-base font-extrabold tabular-nums">{topic.percent}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
        <span>{legendLow}</span>
        <div className="flex h-2.5 flex-1 max-w-48 overflow-hidden rounded-full">
          {HEAT_STEPS.map((s) => (
            <span key={s.min} className={cn("flex-1", s.bg)} />
          ))}
        </div>
        <span>{legendHigh}</span>
      </div>
    </div>
  );
}
