import { getFormatter, getTranslations } from "next-intl/server";
import { CalendarDays, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/motion/fade-in";
import { PlanItemRow } from "@/components/plan/plan-item-row";
import { RegeneratePlanButton } from "@/components/plan/regenerate-button";
import { Badge } from "@/components/ui/badge";
import { getActivePlan } from "@/lib/plan/data";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("plan");
  return { title: t("title") };
}

export default async function PlanPage() {
  const [t, format, plan] = await Promise.all([getTranslations("plan"), getFormatter(), getActivePlan()]);

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={t("title")} description={t("description")} />

      {!plan ? (
        <EmptyState icon={CalendarDays} title={t("empty")} description={t("emptyText")} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-card p-5 shadow-soft">
            <div className="min-w-0 flex-1">
              <Badge variant="secondary" className="mb-2 gap-1">
                {plan.generatedBy === "ai" && <Sparkles className="size-3" aria-hidden />}
                {plan.generatedBy === "ai" ? t("ai") : t("rules")}
              </Badge>
              <p className="text-[15px] leading-relaxed">{plan.summary}</p>
            </div>
            <RegeneratePlanButton />
          </div>

          <ol className="space-y-3">
            {plan.days.map((day) => {
              const isToday = day.date === plan.today;
              return (
                <li
                  key={day.date}
                  className={cn("rounded-2xl bg-card p-4 shadow-soft", isToday && "ring-2 ring-primary")}
                  aria-current={isToday ? "date" : undefined}
                >
                  <p className="mb-2 flex items-center gap-2 px-1 text-sm font-bold">
                    {format.dateTime(new Date(`${day.date}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long" })}
                    {isToday && <Badge>{t("today")}</Badge>}
                  </p>
                  {day.items.length === 0 ? (
                    <p className="px-1 text-sm text-muted-foreground">{t("restDay")}</p>
                  ) : (
                    <div className="space-y-1">
                      {day.items.map((item, i) => (
                        <PlanItemRow key={`${day.date}-${i}`} item={item} />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </FadeIn>
  );
}
