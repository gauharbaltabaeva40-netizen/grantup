import { BookOpen, Calculator, Code2, GraduationCap, Landmark, Sigma, type LucideIcon } from "lucide-react";

const icons: Record<string, LucideIcon> = {
  landmark: Landmark,
  calculator: Calculator,
  "book-open": BookOpen,
  sigma: Sigma,
  code: Code2,
};

/** Пән белгісі (subjects.icon) — пәннің түсімен боялған шаршы. */
export function SubjectIcon({ icon, color, className = "size-12" }: { icon: string | null; color: string | null; className?: string }) {
  const Icon = (icon && icons[icon]) || GraduationCap;
  const tone = color ?? "#0047FF";
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-2xl ${className}`}
      style={{ backgroundColor: `${tone}1f`, color: tone }}
    >
      <Icon className="size-1/2" aria-hidden />
    </div>
  );
}
