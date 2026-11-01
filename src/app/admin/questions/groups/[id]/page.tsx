import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GroupEditor } from "@/components/admin/question-editor";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { adminPage, loadQuestionRefs, plainSnippet } from "@/lib/admin/server";
import { signedQuestionImage } from "@/lib/storage";

export const metadata = { title: "Контекстік мәтін" };
export const dynamic = "force-dynamic";

export default async function QuestionGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await adminPage();
  const isNew = id === "new";
  if (!isNew && (!db || !/^[0-9a-f-]{36}$/i.test(id))) notFound();

  const refs = db ? await loadQuestionRefs(db) : { subjects: [{ id: 1, title: "Демо пән" }], topics: [], groups: [] };
  if (refs.subjects.length === 0) notFound();

  const group = !isNew && db ? (await db.from("question_groups").select("*").eq("id", id).maybeSingle()).data : null;
  if (!isNew && !group) notFound();
  const questions = group && db ? ((await db.from("questions").select("id, stem").eq("group_id", group.id).order("created_at")).data ?? []) : [];

  return (
    <div className="space-y-5">
      <Link href="/admin/questions/groups" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Контекстік мәтіндер
      </Link>
      <AdminHeader title={isNew ? "Жаңа мәтін" : group?.title || "Контекстік мәтін"} />
      <Panel>
        <GroupEditor
          refs={refs}
          questions={questions.length}
          imageUrl={group ? await signedQuestionImage(group.image_path) : null}
          initial={
            group
              ? {
                  id: group.id,
                  subject_id: group.subject_id,
                  topic_id: group.topic_id,
                  locale: group.locale,
                  title: group.title,
                  passage: group.passage,
                  image_path: group.image_path,
                }
              : { subject_id: refs.subjects[0].id, topic_id: null, locale: "kk", title: null, passage: "", image_path: null }
          }
        />
      </Panel>
      {questions.length > 0 && (
        <Panel title="Осы мәтіннің сұрақтары">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {questions.map((q) => (
              <li key={q.id}>
                <Link href={`/admin/questions/${q.id}`} className="hover:text-primary">
                  {plainSnippet(q.stem)}
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
