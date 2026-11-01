import { getTranslations } from "next-intl/server";
import { GrantAccessForm, GrantRow } from "@/components/admin/access-grants";
import { BulkGrantForm } from "@/components/admin/bulk-grant";
import { inputClass } from "@/components/admin/ui";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminPage, almatyDate, stringParam, toGrantView } from "@/lib/admin/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("access") };
}

export const dynamic = "force-dynamic";

export default async function AdminAccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getTranslations("admin.access");
  const db = await adminPage();
  const q = stringParam((await searchParams).q)?.toLowerCase().replace(/[%_,()*\\]/g, "");

  let query = db
    ?.from("access_grants")
    .select("id, email, user_id, starts_at, ends_at, revoked_at, note")
    .order("created_at", { ascending: false })
    .limit(200);
  if (query && q) query = query.ilike("email", `%${q}%`);
  const grants = query ? (await query).data : [];

  const views = (grants ?? []).map((g) => toGrantView(g));

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
          <CardTitle className="text-base font-bold">CSV арқылы көп оқушыға доступ беру</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkGrantForm defaultStart={today} defaultEnd={defaultEnd} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-soft ring-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-bold">{t("listTitle")}</CardTitle>
          <form className="w-full sm:w-64">
            <input name="q" defaultValue={q} placeholder="Email бойынша іздеу" aria-label="Email бойынша іздеу" className={inputClass} />
          </form>
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
