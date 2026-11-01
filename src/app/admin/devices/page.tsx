import { getTranslations } from "next-intl/server";
import { Inbox } from "lucide-react";
import { DeviceRequestCard, type RequestView } from "@/components/admin/device-request-card";
import { EmptyState } from "@/components/brand/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { adminPage } from "@/lib/admin/server";

export async function generateMetadata() {
  const t = await getTranslations("admin.nav");
  return { title: t("devices") };
}

export const dynamic = "force-dynamic";

export default async function AdminDevicesPage() {
  const t = await getTranslations("admin.devices");
  const supabase = await adminPage();
  if (!supabase) {
    return (
      <>
        <PageHeader title={(await getTranslations("admin.nav"))("devices")} description={t("description")} />
        <EmptyState icon={Inbox} title={t("empty")} />
      </>
    );
  }

  // code_hash бағаны ешқашан оқылмайды
  const { data: requests } = await supabase
    .from("device_requests")
    .select("id, user_id, label, city, ip, status, failed_attempts, created_at")
    .in("status", ["pending", "approved", "blocked"])
    .order("created_at", { ascending: true })
    .limit(100);

  const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
  const [{ data: profiles }, { data: devices }] = userIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", userIds),
        supabase
          .from("devices")
          .select("id, user_id, label, last_seen_at, last_city")
          .in("user_id", userIds)
          .is("revoked_at", null)
          .order("last_seen_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const views: RequestView[] = (requests ?? []).map((r) => {
    const profile = profiles?.find((p) => p.id === r.user_id);
    return {
      ...r,
      studentName: profile?.full_name || profile?.email || "—",
      studentEmail: profile?.email ?? "",
      activeDevices: (devices ?? []).filter((d) => d.user_id === r.user_id),
    };
  });

  return (
    <>
      <PageHeader title={(await getTranslations("admin.nav"))("devices")} description={t("description")} />
      {views.length === 0 ? (
        <EmptyState icon={Inbox} title={t("empty")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {views.map((v) => (
            <DeviceRequestCard key={v.id} request={v} />
          ))}
        </div>
      )}
    </>
  );
}
