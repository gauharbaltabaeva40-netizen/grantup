import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { WeekCountdown } from "@/components/gamification/week-countdown";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/motion/fade-in";
import { buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { getLeagueView } from "@/lib/gamification/data";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations("league");
  return { title: t("title") };
}

export default async function LeaguePage() {
  const [t, tv, locale] = await Promise.all([getTranslations("league"), getTranslations("leagueView"), getLocale()]);
  const league = isSupabaseConfigured ? await getLeagueView(locale) : null;

  if (!league) {
    return (
      <FadeIn>
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState icon={Trophy} title={t("emptyTitle")} description={t("emptyText")} />
      </FadeIn>
    );
  }

  const n = league.standings.length;
  const promoteUntil = league.tier.tier < league.maxTier ? league.promote : 0;
  const demoteFrom = league.tier.tier > 1 ? Math.max(n - league.demote, league.promote) : Infinity;

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Лига белгісі */}
      <section className="flex items-center gap-4 rounded-2xl p-5 text-white shadow-soft" style={{ background: `linear-gradient(135deg, ${league.tier.color}, #14213d)` }}>
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/15">
          <Trophy className="size-9" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold">{league.tier.name}</h2>
          <p className="text-sm text-white/85">
            {league.nextTier ? tv("next", { name: league.nextTier.name }) : tv("top")}
          </p>
          <div className="mt-1 text-white/90">
            <WeekCountdown endsAt={league.weekEndsAt} />
          </div>
        </div>
      </section>

      {league.lastWeek && (
        <p
          className={cn(
            "rounded-2xl px-4 py-3 text-[15px] font-medium",
            league.lastWeek.outcome === "promoted" ? "bg-success/12" : league.lastWeek.outcome === "demoted" ? "bg-danger/10" : "bg-muted",
          )}
        >
          {tv(`lastWeek.${league.lastWeek.outcome}`, { rank: league.lastWeek.rank ?? "—" })}
        </p>
      )}

      {n === 0 ? (
        <EmptyState
          icon={Trophy}
          title={tv("notJoined")}
          description={tv("notJoinedText")}
          action={
            <Link href="/lessons" className={buttonVariants({ variant: "brand", size: "2xl" })}>
              {tv("toLessons")}
            </Link>
          }
        />
      ) : (
        <ol className="overflow-hidden rounded-2xl bg-card shadow-soft">
          {league.standings.map((m) => {
            const zone = m.rank <= promoteUntil ? "up" : m.rank > demoteFrom ? "down" : null;
            return (
              <li key={m.userId}>
                {m.rank === promoteUntil + 1 && promoteUntil > 0 && (
                  <p className="flex items-center gap-1.5 border-y bg-success/8 px-4 py-1.5 text-xs font-bold text-success">
                    <ArrowUp className="size-3.5" aria-hidden />
                    {tv("promoteZone")}
                  </p>
                )}
                {m.rank === Math.floor(demoteFrom) + 1 && (
                  <p className="flex items-center gap-1.5 border-y bg-danger/8 px-4 py-1.5 text-xs font-bold text-danger">
                    <ArrowDown className="size-3.5" aria-hidden />
                    {tv("demoteZone")}
                  </p>
                )}
                <div className={cn("flex items-center gap-3 px-4 py-3", m.isMe && "bg-secondary")}>
                  <span
                    className={cn(
                      "w-7 text-center text-sm font-extrabold tabular-nums",
                      zone === "up" ? "text-success" : zone === "down" ? "text-danger" : "text-muted-foreground",
                    )}
                  >
                    {m.rank}
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white" aria-hidden>
                    {m.avatar ?? m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {m.name}
                    {m.isMe && <span className="ml-1.5 text-xs font-bold text-primary">({tv("you")})</span>}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{tv("weeklyXp", { xp: m.weeklyXp })}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-center text-xs text-muted-foreground">{tv("rules", { promote: league.promote, demote: league.demote })}</p>
    </FadeIn>
  );
}
