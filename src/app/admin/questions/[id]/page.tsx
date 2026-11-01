import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QuestionEditor } from "@/components/admin/question-editor";
import { AdminHeader, Panel, Stat } from "@/components/admin/ui";
import { adminPage, formatDateTime, loadQuestionRefs } from "@/lib/admin/server";
import { signedQuestionImage } from "@/lib/storage";

export const metadata = { title: "Сұрақты өңдеу" };
export const dynamic = "force-dynamic";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await adminPage();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [{ data: question }, { data: options }, refs, { data: acc }, { count: mocks }] = await Promise.all([
    db.from("questions").select("*").eq("id", id).maybeSingle(),
    db.from("question_options").select("id, content, is_correct, position").eq("question_id", id).order("position"),
    loadQuestionRefs(db),
    db.rpc("admin_question_accuracy", { p_ids: [id] }),
    db.from("mock_exam_questions").select("mock_exam_id", { count: "exact", head: true }).eq("question_id", id),
  ]);
  if (!question) notFound();

  const stats = acc?.[0];
  const total = Number(stats?.total ?? 0);

  return (
    <div className="space-y-5">
      <Link href="/admin/questions" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Сұрақтар
      </Link>
      <AdminHeader
        title="Сұрақты өңдеу"
        description={`Жасалды: ${formatDateTime(question.created_at)} · көзі: ${question.source ?? "—"}`}
      />
      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <Stat label="Жауаптар" value={total} />
        <Stat label="Дұрыс үлесі" value={total ? `${Math.round((Number(stats?.correct ?? 0) / total) * 100)}%` : "—"} />
        <Stat label="Сынақтарда" value={mocks ?? 0} />
      </div>
      <Panel>
        <QuestionEditor
          refs={refs}
          imageUrl={await signedQuestionImage(question.image_path)}
          initial={{
            id: question.id,
            subject_id: question.subject_id,
            topic_id: question.topic_id,
            group_id: question.group_id,
            type: question.type,
            locale: question.locale,
            difficulty: question.difficulty,
            stem: question.stem,
            image_path: question.image_path,
            explanation: question.explanation,
            is_active: question.is_active,
            options: (options ?? []).map((o) => ({ id: o.id, content: o.content, is_correct: o.is_correct })),
          }}
        />
      </Panel>
    </div>
  );
}
