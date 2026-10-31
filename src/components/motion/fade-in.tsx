import { cn } from "@/lib/utils";

type FadeInProps = {
  children: React.ReactNode;
  /** секунд */
  delay?: number;
  className?: string;
};

/**
 * Бет элементтерінің жеңіл пайда болуы.
 * Таза CSS (tw-animate-css): JS жүктелмей тұрып та мазмұн көрінеді, «қозғалысты азайту» баптауын құрметтейді.
 */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 ease-out motion-reduce:animate-none",
        className,
      )}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
