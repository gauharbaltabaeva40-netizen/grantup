"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";

/** Лига аптасының аяқталуына дейінгі уақыт (минут сайын жаңарады). */
export function WeekCountdown({ endsAt }: { endsAt: string }) {
  const t = useTranslations("leagueView");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, new Date(endsAt).getTime() - now);
  const d = Math.floor(left / 86400_000);
  const h = Math.floor((left % 86400_000) / 3600_000);
  const m = Math.floor((left % 3600_000) / 60_000);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <Clock className="size-4" aria-hidden />
      {t("endsIn", { time: d > 0 ? t("days", { d, h }) : t("hours", { h, m }) })}
    </span>
  );
}
