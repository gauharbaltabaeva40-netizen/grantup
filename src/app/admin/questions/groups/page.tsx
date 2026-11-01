import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { adminPage, plainSnippet } from "@/lib/admin/server";

export const metadata = { title: "Контекстік мәтіндер" };
export const dynamic = "force-dynamic";

export default async function QuestionGroupsPage() {
  const db = await adminPage();
  const [groups, subjects, questions] = db
    ? await Promise.all([
        db.from("question_groups").select("id, subject_id, locale, title, passage, created_at").order("created_at", { ascending: false }).limit(300),
        db.from("subjects").select("id, title_kk"),
        db.from("questions").select("group_id").not("group_id", "is", null),
      ]).then(([g, s, q]) => [g.data ?? [], s.data ?? [], q.data ?? []] as const)
    : ([[], [], []] as const);

  return (
    <div className="space-y-5">
      <Link href="/admin/questions" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Сұрақтар
      </Link>
      <AdminHeader
        title="Контекстік мәтіндер"
        description="Бір мәтінге/суретке бірнеше сұрақ (оқу сауаттылығы, контекстік тапсырмалар). Сынақта бір мәтіннің сұрақтары қатар тұрады."
        actions={
          <Link href="/admin/questions/groups/new" className="flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Жаңа мәтін
          </Link>
        }
      />
      <Panel>
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Әзірге мәтін жоқ.</p>
        ) : (
          <ul className="divide-y">
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={`/admin/questions/groups/${g.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{g.title || plainSnippet(g.passage, 80)}</span>
                    <span className="text-xs text-muted-foreground">
                      {subjects.find((s) => s.id === g.subject_id)?.title_kk} · {g.locale}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{questions.filter((q) => q.group_id === g.id).length} сұрақ</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
