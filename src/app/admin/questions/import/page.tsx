import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QuestionImport } from "@/components/admin/question-import";
import { TextImport } from "@/components/admin/text-import";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { adminPage, stringParam } from "@/lib/admin/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Сұрақ импорттау" };
export const dynamic = "force-dynamic";

const DEMO_SUBJECTS = ["history_kz", "reading_literacy", "math_literacy", "math", "informatics"];

export default async function ImportQuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const mode = stringParam((await searchParams).mode) === "excel" ? "excel" : "text";
  const db = await adminPage();
  const [subjectRows, topicRows] = db
    ? await Promise.all([
        db.from("subjects").select("id, code, title_kk").order("position").then((r) => r.data ?? []),
        db.from("topics").select("subject_id, title_kk, position").order("position").then((r) => r.data ?? []),
      ])
    : [DEMO_SUBJECTS.map((code, i) => ({ id: i, code, title_kk: code })), []];
  const subjects = subjectRows.map((s) => ({
    code: s.code,
    title: s.title_kk,
    topics: topicRows.filter((t) => t.subject_id === s.id).map((t) => t.title_kk),
  }));

  const tab = (value: "text" | "excel", label: string) => (
    <Link
      href={value === "text" ? "/admin/questions/import" : "/admin/questions/import?mode=excel"}
      aria-current={mode === value ? "page" : undefined}
      className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold", mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      <Link href="/admin/questions" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Сұрақтар
      </Link>
      <AdminHeader
        title="Сұрақ импорттау"
        description="Бір реттік шек — 500 сұрақ. Контекстік мәтінді сұрақтар (бірнеше сұраққа ортақ мәтін) редакторда қосылады."
      />
      <div className="inline-flex gap-1 rounded-xl border bg-card p-1">
        {tab("text", "Мәтіннен (Word/PDF)")}
        {tab("excel", "Excel/CSV")}
      </div>
      <Panel>{mode === "text" ? <TextImport subjects={subjects} /> : <QuestionImport subjects={subjects} />}</Panel>
    </div>
  );
}
