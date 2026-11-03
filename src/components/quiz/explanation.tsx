import { useTranslations } from "next-intl";
import { Lightbulb } from "lucide-react";
import { Markdown } from "@/components/content/markdown";
import { cn } from "@/lib/utils";

/** Сұрақтың алдын ала жазылған қысқа түсіндірмесі (админ сұрақ редакторында толтырады). */
export function Explanation({ text, className }: { text?: string | null; className?: string }) {
  const t = useTranslations("quiz");
  const body = text?.trim();

  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-1 rounded-2xl border border-brand-violet/20 bg-brand-violet/5 p-3.5 duration-300", className)}>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-brand-violet">
        <Lightbulb className="size-4" aria-hidden />
        {t("why")}
      </p>
      {body ? (
        <Markdown className="text-[15px] leading-relaxed">{body}</Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noExplanation")}</p>
      )}
    </div>
  );
}
