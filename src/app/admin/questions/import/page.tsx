import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuestionImport } from "@/components/admin/question-import";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { adminPage } from "@/lib/admin/server";

export const metadata = { title: "Сұрақ импорттау" };
export const dynamic = "force-dynamic";

const DEMO_SUBJECTS = ["history_kz", "reading_literacy", "math_literacy", "math", "informatics"];

export default async function ImportQuestionsPage() {
  const db = await adminPage();
  const subjects = db
    ? ((await db.from("subjects").select("code, title_kk").order("position")).data ?? []).map((s) => ({ code: s.code, title: s.title_kk }))
    : DEMO_SUBJECTS.map((code) => ({ code, title: code }));

  return (
    <div className="space-y-5">
      <Link href="/admin/questions" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Сұрақтар
      </Link>
      <AdminHeader title="Excel/CSV-тен импорттау" description="Бір реттік шек — 500 сұрақ. Контекстік мәтінді сұрақтар редакторда қосылады." />
      <Panel>
        <QuestionImport subjects={subjects} />
      </Panel>
    </div>
  );
}
