import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GrantAccessForm, GrantRow } from "@/components/admin/access-grants";
import { RevokeDeviceButton } from "@/components/admin/revoke-device-button";
import { AdminHeader, Panel, Stat } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { adminPage, almatyDate, formatDateTime, toGrantView } from "@/lib/admin/server";

export const metadata = { title: "Оқушы" };
export const dynamic = "force-dynamic";

const kindLabel = {
  diagnostic: "Диагностика",
  lesson_quiz: "Сабақ тесті",
  practice: "Жаттығу",
  mistakes: "Қателер",
  duel: "Дуэль",
  mock: "Сынақ ҰБТ",
} as const;

const statusLabel = { in_progress: "Жүріп жатыр", finished: "Аяқталды", expired: "Уақыт бітті", abandoned: "Тасталды" } as const;

export default async function AdminStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await adminPage();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: profile } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) notFound();

  const grantColumns = "id, email, user_id, starts_at, ends_at, revoked_at, note";
  const [{ data: grantsById }, { data: grantsByEmail }, { data: devices }, { data: attempts }, { data: events }, { count: mistakes }, { count: lessonsDone }] =
    await Promise.all([
      db.from("access_grants").select(grantColumns).eq("user_id", profile.id).order("created_at", { ascending: false }),
      db.from("access_grants").select(grantColumns).eq("email", profile.email).is("user_id", null),
      db
        .from("devices")
        .select("id, label, last_city, last_ip, last_seen_at, created_at, revoked_at")
        .eq("user_id", profile.id)
        .order("last_seen_at", { ascending: false })
        .limit(10),
      db
        .from("attempts")
        .select("id, kind, status, score, max_score, started_at, finished_at")
        .eq("user_id", profile.id)
        .order("started_at", { ascending: false })
        .limit(15),
      db
        .from("security_events")
        .select("id, type, severity, city, ip, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(15),
      db.from("user_mistakes").select("question_id", { count: "exact", head: true }).eq("user_id", profile.id).is("resolved_at", null),
      db.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", profile.id).not("completed_at", "is", null),
    ]);

  const grantViews = [...(grantsById ?? []), ...(grantsByEmail ?? [])].map((g) => toGrantView(g));
  const mocks = (attempts ?? []).filter((a) => a.kind === "mock" && a.score != null && a.max_score);
  const lastMock = mocks[0];
  const today = almatyDate(new Date());
  const defaultEnd = almatyDate(new Date(Date.now() + 90 * 24 * 3600_000));

  return (
    <div className="space-y-5">
      <Link href="/admin/students" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Оқушылар
      </Link>
      <AdminHeader
        title={profile.full_name || profile.email}
        description={`${profile.email} · тіркелді ${formatDateTime(profile.created_at)} · ${profile.role === "admin" ? "админ" : "оқушы"}`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Деңгей / XP" value={`${profile.level} / ${profile.xp}`} />
        <Stat label="Streak" value={profile.streak} hint={`Ең ұзақ: ${profile.longest_streak}`} />
        <Stat label="Өткен сабақ" value={lessonsDone ?? 0} />
        <Stat label="Түзетілмеген қате" value={mistakes ?? 0} />
        <Stat
          label="Соңғы сынақ"
          value={lastMock ? `${Math.round((Number(lastMock.score) / Number(lastMock.max_score)) * 140)}` : "—"}
          hint={`Мақсат: ${profile.target_score ?? "—"}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Доступ">
          {grantViews.length === 0 ? (
            <p className="mb-4 text-sm text-muted-foreground">Доступ берілмеген — оқушы тегін режимде.</p>
          ) : (
            <ul className="mb-5 divide-y">
              {grantViews.map((g) => (
                <GrantRow key={g.id} grant={g} />
              ))}
            </ul>
          )}
          <GrantAccessForm defaultStart={today} defaultEnd={defaultEnd} defaultEmail={profile.email} />
        </Panel>

        <Panel title="Құрылғылар">
          {(devices ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Тіркелген құрылғы жоқ.</p>
          ) : (
            <ul className="divide-y">
              {(devices ?? []).map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {d.label} {d.revoked_at && <Badge variant="outline">Өшірілген</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[d.last_city, d.last_ip].filter(Boolean).join(" · ") || "—"} · соңғы: {formatDateTime(d.last_seen_at)}
                    </p>
                  </div>
                  {!d.revoked_at && <RevokeDeviceButton deviceId={d.id} />}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Соңғы тесттер">
          {(attempts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Әлі тест тапсырмаған.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(attempts ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{kindLabel[a.kind]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(a.finished_at ?? a.started_at)} · {statusLabel[a.status]}
                    </span>
                  </span>
                  {a.kind === "mock" && (
                    <Link href={`/admin/proctoring/${a.id}`} className="ml-auto text-xs font-semibold text-primary">
                      Прокторинг
                    </Link>
                  )}
                  <span className="font-bold tabular-nums">
                    {a.score != null && a.max_score
                      ? a.kind === "mock"
                        ? `${Math.round((Number(a.score) / Number(a.max_score)) * 140)} / 140`
                        : `${Number(a.score)} / ${Number(a.max_score)}`
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Қауіпсіздік оқиғалары">
          {(events ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Оқиға жоқ.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-semibold">{e.type}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(e.created_at)} · {[e.city, e.ip].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <Badge variant={e.severity === "critical" ? "destructive" : e.severity === "warning" ? "secondary" : "outline"}>
                    {e.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/admin/security?user=${profile.id}`} className="mt-3 inline-block text-sm font-semibold text-primary">
            Толық журнал →
          </Link>
        </Panel>
      </div>
    </div>
  );
}
