import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { QuestionEditor } from "@/components/admin/question-editor";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { adminPage, loadQuestionRefs, stringParam } from "@/lib/admin/server";

export const metadata = { title: "Жаңа сұрақ" };
export const dynamic = "force-dynamic";

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const db = await adminPage();
  const params = await searchParams;
  const refs = db ? await loadQuestionRefs(db) : { subjects: [{ id: 1, title: "Демо пән" }], topics: [], groups: [] };
  if (refs.subjects.length === 0) notFound();

  // ?group=<id> — контекстік мәтінге сұрақ қосу; ?subject=<id> — пән алдын ала таңдалады
  const group = refs.groups.find((g) => g.id === stringParam(params.group));
  const subjectId = group?.subject_id ?? (refs.subjects.find((s) => s.id === Number(stringParam(params.subject)))?.id || refs.subjects[0].id);

  return (
    <div className="space-y-5">
      <Link href="/admin/questions" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Сұрақтар
      </Link>
      <AdminHeader title="Жаңа сұрақ" />
      <Panel>
        <QuestionEditor
          refs={refs}
          imageUrl={null}
          initial={{
            subject_id: subjectId,
            topic_id: null,
            group_id: group?.id ?? null,
            type: "single",
            locale: group?.locale ?? "kk",
            difficulty: 2,
            stem: "",
            image_path: null,
            explanation: "",
            is_active: true,
            options: [0, 1, 2, 3].map((i) => ({ content: "", is_correct: i === 0 })),
          }}
        />
      </Panel>
    </div>
  );
}
