import Link from "next/link";
import { AdminHeader, inputClass, Pager, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { adminPage, formatDateTime, pageParam, stringParam } from "@/lib/admin/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Журнал" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const UUID_RE = /^[0-9a-f-]{36}$/i;

const EVENT_LABEL: Record<string, string> = {
  login: "Кіру",
  suspicious_login: "Күдікті кіру",
  device_added: "Құрылғы қосылды",
  device_confirmed: "Құрылғы расталды",
  device_limit_reached: "Құрылғы шегі",
  copy_attempt: "Көшіру әрекеті",
  devtools_open: "DevTools",
  screenshot_key: "Скриншот пернесі",
  print_attempt: "Басып шығару",
  save_attempt: "Сақтау әрекеті",
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminSecurityPage({ searchParams }: { searchParams: Search }) {
  const db = await adminPage();
  const params = await searchParams;
  const tab = stringParam(params.tab) === "audit" ? "audit" : "events";
  const page = pageParam(params.page);
  const severity = stringParam(params.severity);
  const type = stringParam(params.type);
  const user = stringParam(params.user);
  const userId = user && UUID_RE.test(user) ? user : undefined;

  type EventRow = { id: number; user_id: string | null; type: string; severity: string; ip: string | null; city: string | null; country: string | null; meta: Record<string, unknown>; created_at: string };
  type AuditRow = { id: number; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; meta: Record<string, unknown>; created_at: string };
  let events: EventRow[] = [];
  let audits: AuditRow[] = [];
  const emails = new Map<string, string>();

  if (db) {
    const from = (page - 1) * PAGE_SIZE;
    if (tab === "events") {
      let query = db
        .from("security_events")
        .select("id, user_id, type, severity, ip, city, country, meta, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE);
      if (severity === "info" || severity === "warning" || severity === "critical") query = query.eq("severity", severity);
      if (severity === "alerts") query = query.neq("severity", "info");
      if (type && /^[a-z_]+$/.test(type)) query = query.eq("type", type);
      if (userId) query = query.eq("user_id", userId);
      events = ((await query).data ?? []) as EventRow[];
    } else {
      let query = db
        .from("audit_log")
        .select("id, actor_id, action, target_type, target_id, meta, created_at")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE);
      if (userId) query = query.eq("actor_id", userId);
      audits = ((await query).data ?? []) as AuditRow[];
    }
    const ids = [...new Set([...events.map((e) => e.user_id), ...audits.map((a) => a.actor_id)].filter((x): x is string => Boolean(x)))];
    if (ids.length) {
      const { data } = await db.from("profiles").select("id, email").in("id", ids);
      for (const p of data ?? []) emails.set(p.id, p.email);
    }
  }

  const rows = tab === "events" ? events : audits;
  const hasNext = rows.length > PAGE_SIZE;
  const tabLink = (t: string) => `/admin/security?tab=${t}${userId ? `&user=${userId}` : ""}`;

  return (
    <>
      <AdminHeader title="Журнал" description="Қауіпсіздік оқиғалары (кіру, құрылғылар, контентті көшіру әрекеттері) және админ әрекеттері." />

      <nav className="mb-4 flex gap-2">
        {[
          ["events", "Қауіпсіздік оқиғалары"],
          ["audit", "Админ әрекеттері"],
        ].map(([t, label]) => (
          <Link
            key={t}
            href={tabLink(t)}
            className={cn("rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted", tab === t && "border-primary bg-secondary text-primary hover:bg-secondary")}
          >
            {label}
          </Link>
        ))}
      </nav>

      <Panel>
        {tab === "events" && (
          <form className="mb-4 flex flex-wrap gap-2">
            <input type="hidden" name="tab" value="events" />
            {userId && <input type="hidden" name="user" value={userId} />}
            <select name="severity" defaultValue={severity ?? ""} aria-label="Деңгейі" className={`${inputClass} w-auto`}>
              <option value="">Барлық деңгей</option>
              <option value="alerts">Тек ескертулер</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
            <select name="type" defaultValue={type ?? ""} aria-label="Түрі" className={`${inputClass} w-auto`}>
              <option value="">Барлық түр</option>
              {Object.entries(EVENT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Сүзу
            </button>
            {userId && (
              <Link href="/admin/security" className="flex h-10 items-center px-2 text-sm font-semibold text-primary">
                Оқушы сүзгісін алып тастау
              </Link>
            )}
          </form>
        )}

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Жазба жоқ.</p>
        ) : tab === "events" ? (
          <ul className="divide-y">
            {events.slice(0, PAGE_SIZE).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <Badge variant={e.severity === "critical" ? "destructive" : e.severity === "warning" ? "secondary" : "outline"}>{e.severity}</Badge>
                <span className="font-semibold">{EVENT_LABEL[e.type] ?? e.type}</span>
                {e.user_id ? (
                  <Link href={`/admin/students/${e.user_id}`} className="text-primary">
                    {emails.get(e.user_id) ?? e.user_id.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                <span className="text-xs text-muted-foreground">{[e.city, e.country, e.ip].filter(Boolean).join(" · ")}</span>
                {typeof e.meta?.path === "string" && <span className="font-mono text-xs text-muted-foreground">{e.meta.path}</span>}
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatDateTime(e.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y">
            {audits.slice(0, PAGE_SIZE).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="font-mono text-xs font-semibold">{a.action}</span>
                <span className="text-muted-foreground">{a.actor_id ? (emails.get(a.actor_id) ?? a.actor_id.slice(0, 8)) : "жүйе"}</span>
                <span className="max-w-md truncate font-mono text-xs text-muted-foreground" title={JSON.stringify(a.meta)}>
                  {a.target_type}
                  {a.target_id ? `:${a.target_id.slice(0, 8)}` : ""} {Object.keys(a.meta ?? {}).length ? JSON.stringify(a.meta) : ""}
                </span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} hasNext={hasNext} params={{ tab, severity, type, user: userId }} basePath="/admin/security" />
      </Panel>
    </>
  );
}
