import Link from "next/link";
import { AdminHeader, Panel, Stat } from "@/components/admin/ui";
import { adminPage, plainSnippet } from "@/lib/admin/server";

export const metadata = { title: "Шолу" };
export const dynamic = "force-dynamic";

type Overview = Partial<
  Record<
    | "students"
    | "active7"
    | "activeToday"
    | "fullAccess"
    | "mocks30"
    | "avgMock30"
    | "answers7"
    | "pendingDevices"
    | "warnings7"
    | "questions"
    | "lessons",
    number | null
  >
>;

export default async function AdminOverviewPage() {
  const db = await adminPage();

  let overview: Overview = {};
  let hardest: { id: string; stem: string; subject: string; total: number; percent: number }[] = [];

  if (db) {
    const [{ data: o }, { data: rows }] = await Promise.all([
      db.rpc("admin_overview"),
      db.rpc("admin_hardest_questions", { p_min: 5, p_limit: 10 }),
    ]);
    overview = (o ?? {}) as Overview;
    if (rows?.length) {
      const [{ data: questions }, { data: subjects }] = await Promise.all([
        db.from("questions").select("id, stem, subject_id").in("id", rows.map((r) => r.question_id)),
        db.from("subjects").select("id, title_kk"),
      ]);
      hardest = rows.map((r) => {
        const q = questions?.find((x) => x.id === r.question_id);
        return {
          id: r.question_id,
          stem: plainSnippet(q?.stem ?? "—"),
          subject: subjects?.find((s) => s.id === q?.subject_id)?.title_kk ?? "",
          total: Number(r.total),
          percent: Math.round((Number(r.correct) / Number(r.total)) * 100),
        };
      });
    }
  }

  const n = (key: keyof Overview) => overview[key] ?? 0;

  return (
    <>
      <AdminHeader title="Шолу" description="Платформаның негізгі көрсеткіштері (Алматы уақыты бойынша)." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Оқушылар" value={n("students")} hint={`Толық доступ: ${n("fullAccess")}`} />
        <Stat label="Белсенді (7 күн)" value={n("active7")} hint={`Бүгін: ${n("activeToday")}`} />
        <Stat
          label="Сынақ ҰБТ (30 күн)"
          value={n("mocks30")}
          hint={overview.avgMock30 != null ? `Орташа балл: ${overview.avgMock30} / 140` : "Орташа балл: —"}
        />
        <Stat label="Жауаптар (7 күн)" value={n("answers7")} />
        <Stat label="Құрылғы сұраныстары" value={n("pendingDevices")} tone={n("pendingDevices") ? "warn" : undefined} />
        <Stat label="Ескертулер (7 күн)" value={n("warnings7")} tone={n("warnings7") ? "warn" : undefined} />
        <Stat label="Белсенді сұрақтар" value={n("questions")} />
        <Stat label="Жарияланған сабақтар" value={n("lessons")} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel title="Ең қиын сұрақтар">
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">Кемінде 5 жауап берілген, дұрыс жауап үлесі ең төмен сұрақтар.</p>
          {hardest.length === 0 ? (
            <p className="text-sm text-muted-foreground">Статистика жеткіліксіз — оқушылар тест тапсырған сайын толады.</p>
          ) : (
            <ol className="divide-y">
              {hardest.map((q) => (
                <li key={q.id}>
                  <Link href={`/admin/questions/${q.id}`} className="flex items-center gap-3 py-2.5 hover:text-primary">
                    <span
                      className="w-12 shrink-0 text-right text-sm font-extrabold tabular-nums text-danger"
                      title={`${q.total} жауап`}
                    >
                      {q.percent}%
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{q.stem}</span>
                      <span className="text-xs text-muted-foreground">
                        {q.subject} · {q.total} жауап
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title="Жылдам әрекеттер">
          <ul className="space-y-1 text-sm font-semibold">
            {[
              ["/admin/devices", `Құрылғы сұраныстары (${n("pendingDevices")})`],
              ["/admin/access", "Доступ беру / CSV импорт"],
              ["/admin/questions/new", "Жаңа сұрақ"],
              ["/admin/questions/import", "Сұрақтарды Excel-ден импорттау"],
              ["/admin/mocks", "Сынақ ҰБТ құрастыру"],
              ["/admin/security", "Қауіпсіздік журналы"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="block rounded-xl px-3 py-2 hover:bg-muted">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
