import { cn } from "@/lib/utils";

/*
 * «Қызыл қалам» белгілері — «Емтихан қағазы» дизайнының қолтаңбасы.
 * (Тақырыптың астын сызу — CSS-тегі `.pen-underline`, ол көп жолды мәтінде әр жолға бөлек сызылады.)
 * Барлығы сәндік (aria-hidden), анимациясы бір рет ойнайды және prefers-reduced-motion-да өшеді.
 */

type PenProps = { className?: string; delay?: number };

const delayStyle = (delay?: number) => (delay === undefined ? undefined : ({ "--pen-delay": `${delay}s` } as React.CSSProperties));

/** Сөзді/санды қоршаған қолмен сызылған сопақ */
export function PenCircle({ className, delay }: PenProps) {
  return (
    <svg aria-hidden viewBox="0 0 200 90" preserveAspectRatio="none" fill="none" className={cn("pointer-events-none text-pen", className)}>
      <path
        d="M112 6C58 2 10 18 6 44c-4 28 52 42 104 40 52-2 88-18 84-42C190 18 140 4 82 10"
        pathLength={1}
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        className="pen-draw"
        style={delayStyle(delay)}
      />
    </svg>
  );
}

/** Мұғалімнің «дұрыс» белгісі */
export function PenCheck({ className, delay }: PenProps) {
  return (
    <svg aria-hidden viewBox="0 0 40 32" fill="none" className={cn("pointer-events-none text-pen", className)}>
      <path
        d="M4 17c4 3 7 7 10 11C19 18 27 9 37 3"
        pathLength={1}
        stroke="currentColor"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pen-draw"
        style={delayStyle(delay)}
      />
    </svg>
  );
}

/**
 * «РАСТАЛДЫ» мөрі — прокторингпен расталған нәтиженің белгісі.
 * animate=true: мөр «басылады» (бір рет).
 */
export function Stamp({
  label,
  sub,
  className,
  animate = false,
  rotate = -12,
  delay,
}: {
  label: string;
  sub?: string;
  className?: string;
  animate?: boolean;
  rotate?: number;
  delay?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none grid size-28 place-items-center rounded-full border-[3px] border-current p-1.5 text-pen mix-blend-multiply select-none dark:mix-blend-normal",
        animate && "stamp-in",
        className,
      )}
      style={
        {
          "--stamp-rotate": `${rotate}deg`,
          transform: animate ? undefined : `rotate(${rotate}deg)`,
          ...(delay === undefined ? {} : { "--stamp-delay": `${delay}s` }),
        } as React.CSSProperties
      }
    >
      <div className="grid size-full place-items-center rounded-full border border-dashed border-current px-2 text-center">
        <div>
          <p className="text-[15px] leading-none font-black tracking-[0.12em] uppercase">{label}</p>
          {sub && <p className="mt-1 text-[8.5px] leading-tight font-bold tracking-[0.14em] uppercase opacity-90">{sub}</p>}
        </div>
      </div>
    </div>
  );
}
