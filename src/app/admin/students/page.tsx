import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AdminHeader, inputClass, Pager, Panel } from "@/components/admin/ui";
import { adminPage, almatyDate, pageParam, stringParam } from "@/lib/admin/server";

export const metadata = { title: "Оқушылар" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const gradeLabel = { "10": "10-сынып", "11": "11-сынып", graduate: "Түлек" } as const;

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminStudentsPage({ searchParams }: { searchParams: Search }) {
  const db = await adminPage();
  const params = await searchParams;
  const page = pageParam(params.page);
  const q = stringParam(params.q)?.slice(0, 100);
  const access = stringParam(params.access);

  const rows = db
    ? ((
        await db.rpc("admin_students", {
          p_q: q ?? null,
          p_access: access === "full" || access === "free" ? access : null,
          p_limit: PAGE_SIZE + 1,
          p_offset: (page - 1) * PAGE_SIZE,
        })
      ).data ?? [])
    : [];
  const hasNext = rows.length > PAGE_SIZE;
  const students = rows.slice(0, PAGE_SIZE);

  const today = almatyDate(new Date());

  return (
    <>
      <AdminHeader title="Оқушылар" description="Іздеу, прогресс, доступ және құрылғылар. Оқушыны ашу үшін басыңыз." />

      <Panel>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Аты немесе email" aria-label="Іздеу" className={`${inputClass} sm:max-w-xs`} />
          <select name="access" defaultValue={access ?? ""} aria-label="Доступ" className={`${inputClass} w-auto`}>
            <option value="">Барлығы</option>
            <option value="full">Толық доступ</option>
            <option value="free">Тегін</option>
          </select>
          <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
            Іздеу
          </button>
        </form>

        {students.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Оқушы табылмады.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 font-semibold">Оқушы</th>
                  <th className="px-3 py-2 font-semibold">Сынып</th>
                  <th className="px-3 py-2 font-semibold">Деңгей / XP</th>
                  <th className="px-3 py-2 font-semibold">Streak</th>
                  <th className="px-3 py-2 font-semibold">Соңғы белсенділік</th>
                  <th className="px-5 py-2 font-semibold">Доступ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/50">
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/students/${s.id}`} className="block font-semibold hover:text-primary">
                        {s.full_name || "—"}
                        <span className="block text-xs font-normal text-muted-foreground">{s.email}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">{s.grade ? gradeLabel[s.grade] : "—"}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {s.level} / {s.xp}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{s.streak}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {s.last_active_date ? (s.last_active_date === today ? "Бүгін" : s.last_active_date) : "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      {s.has_access ? <Badge>Толық</Badge> : <Badge variant="outline">Тегін</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} hasNext={hasNext} params={{ q, access }} basePath="/admin/students" />
      </Panel>
    </>
  );
}
