import Link from "next/link";
import { CreateMockForm } from "@/components/admin/mock-admin";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { adminPage, formatDateTime } from "@/lib/admin/server";
import { getSetting } from "@/lib/settings";

export const metadata = { title: "Сынақ ҰБТ" };
export const dynamic = "force-dynamic";

export default async function AdminMocksPage() {
  const db = await adminPage();
  const structure = await getSetting("unt_structure");

  const [mocks, items, attempts] = db
    ? await Promise.all([
        db.from("mock_exams").select("id, title_kk, locale, is_free, is_published, created_at").order("created_at", { ascending: false }),
        db.from("mock_exam_questions").select("mock_exam_id"),
        db.from("attempts").select("mock_exam_id").eq("kind", "mock").in("status", ["finished", "expired"]),
      ]).then(([m, i, a]) => [m.data ?? [], i.data ?? [], a.data ?? []] as const)
    : ([[], [], []] as const);

  return (
    <>
      <AdminHeader
        title="Сынақ ҰБТ варианттары"
        description={`Құрылым: ${structure.totalQuestions} сұрақ, ${structure.maxScore} балл, ${structure.durationMinutes} минут (Баптаулар → unt_structure).`}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel title="Варианттар">
          {mocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Әзірге вариант жоқ.</p>
          ) : (
            <ul className="divide-y">
              {mocks.map((m) => {
                const count = items.filter((i) => i.mock_exam_id === m.id).length;
                return (
                  <li key={m.id}>
                    <Link href={`/admin/mocks/${m.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{m.title_kk}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.locale} · {count}/{structure.totalQuestions} сұрақ · {attempts.filter((a) => a.mock_exam_id === m.id).length} тапсырылды ·{" "}
                          {formatDateTime(m.created_at)}
                        </span>
                      </span>
                      {m.is_free && <Badge variant="secondary">Тегін</Badge>}
                      {m.is_published ? <Badge>Жарияланған</Badge> : <Badge variant="outline">Жоба</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Жаңа вариант">
          <p className="-mt-2 mb-4 text-sm text-muted-foreground">
            Әр пәннен құрылымдағы санға сай сұрақ кездейсоқ таңдалады (бір жауапты, көп жауапты, контекстік). Басқа варианттарда аз қолданылған
            сұрақтар бірінші алынады. Вариант жоба ретінде жасалады — тексеріп, жариялаңыз.
          </p>
          <CreateMockForm nextNumber={mocks.length + 1} />
        </Panel>
      </div>
    </>
  );
}
