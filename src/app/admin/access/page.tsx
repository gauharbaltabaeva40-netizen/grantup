import { getTranslations } from "next-intl/server";
import { GrantAccessForm, GrantRow, type GrantView } from "@/components/admin/access-grants";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("access") };
}

export const dynamic = "force-dynamic";

/** Asia/Almaty бойынша YYYY-MM-DD */
function almatyDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(date);
}

export default async function AdminAccessPage() {
  const t = await getTranslations("admin.access");
  const supabase = await createClient();

  const { data: grants } = await supabase
    .from("access_grants")
    .select("id, email, user_id, starts_at, ends_at, revoked_at, note")
    .order("created_at", { ascending: false })
    .limit(200);

  const now = Date.now();
  const views: GrantView[] = (grants ?? []).map((g) => ({
    ...g,
    // ends_at — соңғы күннен кейінгі күннің 00:00-і; адамға соңғы күнді көрсетеміз
    startDate: almatyDate(new Date(g.starts_at)),
    endDate: almatyDate(new Date(new Date(g.ends_at).getTime() - 1)),
    state: g.revoked_at
      ? "revoked"
      : new Date(g.starts_at).getTime() > now
        ? "scheduled"
        : new Date(g.ends_at).getTime() <= now
          ? "expired"
          : "active",
  }));

  const today = almatyDate(new Date());
  const defaultEnd = almatyDate(new Date(Date.now() + 90 * 24 * 3600_000));

  return (
    <div className="space-y-6">
      <PageHeader title={(await getTranslations("admin.nav"))("access")} description={t("description")} />

      <Card className="rounded-2xl shadow-soft ring-0">
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("grantTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <GrantAccessForm defaultStart={today} defaultEnd={defaultEnd} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-soft ring-0">
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("listTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {views.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="divide-y">
              {views.map((g) => (
                <GrantRow key={g.id} grant={g} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
