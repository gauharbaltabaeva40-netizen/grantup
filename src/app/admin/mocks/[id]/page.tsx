import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MockSettingsForm, ReplaceQuestionButton } from "@/components/admin/mock-admin";
import { AdminHeader, Panel, Stat } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { adminPage, plainSnippet } from "@/lib/admin/server";
import type { UntStructure } from "@/lib/settings";

export const metadata = { title: "Сынақ ҰБТ варианты" };
export const dynamic = "force-dynamic";

export default async function AdminMockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await adminPage();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: mock } = await db.from("mock_exams").select("*").eq("id", id).maybeSingle();
  if (!mock) notFound();
  const structure = mock.structure as unknown as UntStructure;

  const [{ data: items }, { data: subjects }, { data: attempts }] = await Promise.all([
    db.from("mock_exam_questions").select("question_id, subject_id, position").eq("mock_exam_id", id).order("position"),
    db.from("subjects").select("id, code, title_kk"),
    db.from("attempts").select("score, max_score").eq("mock_exam_id", id).in("status", ["finished", "expired"]),
  ]);
  const { data: questions } = await db
    .from("questions")
    .select("id, stem, type, group_id, is_active, difficulty")
    .in("id", (items ?? []).map((i) => i.question_id));

  const scores = (attempts ?? []).filter((a) => a.max_score).map((a) => (Number(a.score) / Number(a.max_score)) * 140);
  const avg = scores.length ? Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10 : null;

  return (
    <div className="space-y-5">
      <Link href="/admin/mocks" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Варианттар
      </Link>
      <AdminHeader title={mock.title_kk} description={`Тіл: ${mock.locale} · құрылым ${structure.year} ж.`} />

      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <Stat label="Сұрақтар" value={`${items?.length ?? 0}/${structure.totalQuestions}`} />
        <Stat label="Тапсырылды" value={scores.length} />
        <Stat label="Орташа балл" value={avg ?? "—"} />
      </div>

      <Panel title="Баптаулар">
        <MockSettingsForm mock={{ id: mock.id, title_kk: mock.title_kk, title_ru: mock.title_ru, is_free: mock.is_free, is_published: mock.is_published }} />
      </Panel>

      {structure.sections.map((section) => {
        const subject = subjects?.find((s) => s.code === section.subject);
        const sectionItems = (items ?? []).filter((i) => i.subject_id === subject?.id);
        const active = sectionItems.filter((i) => questions?.find((q) => q.id === i.question_id)?.is_active).length;
        return (
          <Panel
            key={section.subject}
            title={`${subject?.title_kk ?? section.subject}`}
            actions={
              <Badge variant={active === section.questions ? "default" : "destructive"}>
                {active}/{section.questions}
              </Badge>
            }
          >
            {sectionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Сұрақ жоқ.</p>
            ) : (
              <ol className="divide-y">
                {sectionItems.map((item, index) => {
                  const q = questions?.find((x) => x.id === item.question_id);
                  return (
                    <li key={item.question_id} className="flex items-center gap-2 py-2">
                      <span className="w-7 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      <Link href={`/admin/questions/${item.question_id}`} className={`min-w-0 flex-1 truncate text-sm hover:text-primary ${q?.is_active ? "" : "text-danger line-through"}`}>
                        {plainSnippet(q?.stem ?? "—", 120)}
                      </Link>
                      <span className="hidden shrink-0 gap-1 sm:flex">
                        {q?.type === "multiple" && <Badge variant="secondary">Көп</Badge>}
                        {q?.group_id && <Badge variant="outline">Контекст</Badge>}
                      </span>
                      {q && !q.group_id && <ReplaceQuestionButton mockId={mock.id} questionId={q.id} />}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
