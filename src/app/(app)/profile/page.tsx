import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Award, ChevronRight, Lock, LogOut, Monitor, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StreakFreezeCard } from "@/components/gamification/streak-freeze-card";
import { getAccess } from "@/lib/access";
import { getAchievements } from "@/lib/gamification/data";
import { getSetting } from "@/lib/settings";
import { signOut } from "@/lib/auth/actions";
import { getCurrentDeviceId, getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getViewer } from "@/lib/viewer";

export const generateMetadata = () => placeholderMetadata("profile");

export default async function ProfilePage() {
  const viewer = await getViewer();
  const user = await getSessionUser();
  if (!viewer || viewer.demo || !user) return <PlaceholderPage section="profile" icon={UserRound} />;

  const [t, tp, ta, tauth, format, access, currentDeviceId] = await Promise.all([
    getTranslations("profile"),
    getTranslations("profileExtra"),
    getTranslations("access"),
    getTranslations("auth"),
    getFormatter(),
    getAccess(),
    getCurrentDeviceId(),
  ]);

  const [tach, achievements, xpSettings] = await Promise.all([
    getTranslations("achievements"),
    getAchievements(await getLocale()),
    getSetting("xp"),
  ]);
  const earnedCount = achievements.filter((a) => a.earnedAt).length;

  const supabase = await createClient();
  const { data: devices } = await supabase
    .from("devices")
    .select("id, label, last_seen_at, last_city")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  const date = (value: string | number) => format.dateTime(new Date(value), { dateStyle: "medium" });

  return (
    <FadeIn className="space-y-5">
      <PageHeader title={viewer.name} description={viewer.email} />

      <Card className="rounded-2xl shadow-soft ring-0">
        <CardHeader>
          <CardTitle className="text-base font-bold">{tp("access")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant={access.tier === "full" ? "default" : "secondary"} className="h-7 px-3 text-sm">
              {access.tier === "full" ? ta("full") : ta("free")}
            </Badge>
            {access.tier === "full" && (
              // ends_at — соңғы күннен кейінгі күннің басы; адамға соңғы күнді көрсетеміз
              <span className="text-sm text-muted-foreground">
                {ta("until", { date: date(new Date(access.endsAt).getTime() - 1) })}
              </span>
            )}
          </div>
          {access.tier === "free" && (
            <Link href="/upgrade" className={cn(buttonVariants({ variant: "brand", size: "xl" }))}>
              {tp("upgrade")}
              <ChevronRight aria-hidden />
            </Link>
          )}
        </CardContent>
      </Card>

      <StreakFreezeCard freezes={viewer.streakFreezes} xp={viewer.xp} cost={xpSettings.streakFreezeCost} />

      <Card className="rounded-2xl shadow-soft ring-0">
        <CardHeader>
          <CardTitle className="text-base font-bold">{tach("title")}</CardTitle>
          <CardDescription>{tach("earned", { count: earnedCount, total: achievements.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {achievements.map((a) => (
              <li
                key={a.code}
                title={a.description}
                className={cn("flex items-center gap-2.5 rounded-xl p-2.5", a.earnedAt ? "bg-secondary" : "bg-muted/60 opacity-60")}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl",
                    a.earnedAt ? "bg-brand-gradient text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {a.earnedAt ? <Award className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{a.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{a.earnedAt ? a.description : tach("locked")}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-soft ring-0">
        <CardHeader>
          <CardTitle className="text-base font-bold">{tp("devicesTitle")}</CardTitle>
          <CardDescription>{tp("devicesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {(devices ?? []).map((d) => {
              const Icon = /iPhone|Android/.test(d.label) ? Smartphone : Monitor;
              return (
                <li key={d.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                    <Icon className="size-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tp("lastSeen", { date: date(d.last_seen_at) })}
                      {d.last_city ? ` · ${d.last_city}` : ""}
                    </p>
                  </div>
                  {d.id === currentDeviceId && <Badge variant="secondary">{tp("thisDevice")}</Badge>}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        {viewer.role === "admin" && (
          <Link href="/admin/devices" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "sm:flex-1")}>
            <ShieldCheck aria-hidden />
            {tp("adminPanel")}
          </Link>
        )}
        <form action={signOut} className="sm:flex-1">
          <Button type="submit" variant="destructive" size="xl" className="w-full">
            <LogOut aria-hidden />
            {tauth("logout")}
          </Button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground">{t("emptyText")}</p>
    </FadeIn>
  );
}
