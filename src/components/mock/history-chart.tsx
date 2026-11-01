"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter } from "next-intl";

type Point = { attemptId: string; finishedAt: string; score: number; maxScore: number; current: boolean };

const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

/**
 * Алдыңғы сынақтармен салыстыру: балл динамикасы (бір серия — сызық + нүктелер).
 * Y осі 0…ресми ең жоғары балл. Нүктенің үстіне апарғанда — күні мен балы.
 */
export function HistoryChart({ points, yMax, ariaLabel }: { points: Point[]; yMax: number; ariaLabel: string }) {
  const format = useFormatter();
  const [hover, setHover] = useState<number | null>(null);
  // viewBox ені = контейнердің нақты ені: телефонда да мәтін 11–12px болып қалады
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (Math.min(v, yMax) / yMax) * innerH;
  const ticks = [0, Math.round(yMax / 2), yMax];
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score)}`).join(" ");
  const active = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(tick)} dy="0.35em" textAnchor="end" className="fill-muted-foreground text-[11px]">
              {tick}
            </text>
          </g>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-muted-foreground/40" strokeWidth={1} />
        )}
        <path d={path} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.attemptId}>
            <circle
              cx={x(i)}
              cy={y(p.score)}
              r={p.current ? 6 : 4.5}
              className={p.current ? "fill-brand-violet stroke-card" : "fill-primary stroke-card"}
              strokeWidth={2}
            />
            {/* Үлкен көрінбейтін нысана — нүктені оңай табу үшін */}
            <rect
              x={x(i) - innerW / Math.max(points.length, 1) / 2}
              y={PAD.top}
              width={innerW / Math.max(points.length, 1)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(i)}
            />
          </g>
        ))}
        {/* Соңғы нүктенің мәні — тікелей белгі */}
        {points.length > 0 && (
          <text x={x(points.length - 1)} y={y(points.at(-1)!.score) - 12} textAnchor="middle" className="fill-foreground text-[12px] font-bold">
            {points.at(-1)!.score}
          </text>
        )}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute top-0 rounded-xl bg-popover px-3 py-2 text-sm shadow-lg ring-1 ring-foreground/10"
          style={{ left: `${(x(hover!) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <p className="font-bold tabular-nums">
            {active.score} / {active.maxScore}
          </p>
          <p className="text-xs text-muted-foreground">{format.dateTime(new Date(active.finishedAt), { dateStyle: "medium" })}</p>
        </div>
      )}
    </div>
  );
}
