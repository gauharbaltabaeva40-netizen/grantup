import Link from "next/link";
import { AdminHeader, Pager, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { adminPage, formatDateTime, pageParam, stringParam } from "@/lib/admin/server";
import { IntegrityBadge } from "@/components/admin/integrity-badge";
import { PROCTORING_RETENTION_DAYS } from "@/lib/proctoring/constants";
import { integrityIndex } from "@/lib/proctoring/integrity";
import type { ProctoringEventType } from "@/lib/supabase/types";

export const metadata = { title: "Прокторинг" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const statusLabel = { in_progress: "Жүріп жатыр", finished: "Аяқталды", expired: "Уақыт бітті", abandoned: "Тасталды" } as const;

export default async function AdminProctoringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const db = await adminPage();
  const params = await searchParams;
  const page = pageParam(params.page);
  const user = stringParam(params.user);
  const userId = user && /^[0-9a-f-]{36}$/i.test(user) ? user : null;

  const rows = db
    ? ((await db.rpc("admin_proctoring_attempts", { p_limit: PAGE_SIZE + 1, p_offset: (page - 1) * PAGE_SIZE, p_user: userId })).data ?? [])
    : [];
  const list = rows.slice(0, PAGE_SIZE);
  const ids = [...new Set(list.map((r) => r.user_id))];
  const profiles = db && ids.length ? ((await db.from("profiles").select("id, full_name, email").in("id", ids)).data ?? []) : [];
  // Адалдық индексі: «қате дабыл» белгісін ескеру үшін оқиғалардан есептейміз
  const attemptIds = list.map((r) => r.attempt_id);
  const events =
    db && attemptIds.length
      ? ((await db.from("proctoring_events").select("attempt_id, type, dismissed_at").in("attempt_id", attemptIds).limit(20000)).data ?? [])
      : [];
  const indexOf = (attemptId: string) =>
    integrityIndex(events.filter((e) => e.attempt_id === attemptId) as { type: ProctoringEventType; dismissed_at: string | null }[]);

  return (
    <>
      <AdminHeader
        title="Прокторинг"
        description={`Сынақ ҰБТ камера бақылауы. Бұзушылықтар тек тіркеледі. Адалдық индексі (0–100) тек әкімшіге көрінеді. Фотолар ${PROCTORING_RETENTION_DAYS} күннен кейін автоматты өшіріледі.`}
      />
      <Panel>
        {userId && (
          <Link href="/admin/proctoring" className="mb-3 inline-block text-sm font-semibold text-primary">
            ← Барлық оқушы
          </Link>
        )}
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Әзірге прокторингпен тапсырылған сынақ жоқ.</p>
        ) : (
          <ul className="divide-y">
            {list.map((r) => {
              const p = profiles.find((x) => x.id === r.user_id);
              const violations =
                Number(r.no_face) + Number(r.multiple_faces) + Number(r.phone_detected) + Number(r.looking_away) + Number(r.camera_off) + Number(r.tab_hidden);
              return (
                <li key={r.attempt_id}>
                  <Link href={`/admin/proctoring/${r.attempt_id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3 hover:text-primary">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p?.full_name || p?.email || "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(r.started_at)} · {statusLabel[r.status]} · {Number(r.snapshots)} фото
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      <IntegrityBadge index={indexOf(r.attempt_id)} />
                      {violations === 0 && <Badge variant="outline">Бұзушылық жоқ</Badge>}
                      {Number(r.no_face) > 0 && <Badge variant="destructive">Бет жоқ: {Number(r.no_face)}</Badge>}
                      {Number(r.multiple_faces) > 0 && <Badge variant="destructive">Бірнеше адам: {Number(r.multiple_faces)}</Badge>}
                      {Number(r.phone_detected) > 0 && <Badge variant="destructive">Телефон: {Number(r.phone_detected)}</Badge>}
                      {Number(r.looking_away) > 0 && <Badge variant="secondary">Басын бұрды: {Number(r.looking_away)}</Badge>}
                      {Number(r.tab_hidden) > 0 && <Badge variant="secondary">Басқа бет: {Number(r.tab_hidden)}</Badge>}
                      {Number(r.camera_off) > 0 && <Badge variant="secondary">Камера өшті: {Number(r.camera_off)}</Badge>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={page} hasNext={rows.length > PAGE_SIZE} params={{ user: userId ?? undefined }} basePath="/admin/proctoring" />
      </Panel>
    </>
  );
}
