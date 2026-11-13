import Link from "next/link";
import { FileUp, Layers, Plus } from "lucide-react";
import { AdminHeader, inputClass, Pager, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { adminPage, loadQuestionRefs, pageParam, plainSnippet, stringParam } from "@/lib/admin/server";

export const metadata = { title: "Сұрақтар" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function AdminQuestionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const db = await adminPage();
  const params = await searchParams;
  const page = pageParam(params.page);
  const subject = Number(stringParam(params.subject)) || undefined;
  const topic = stringParam(params.topic);
  const type = stringParam(params.type);
  const locale = stringParam(params.locale);
  const status = stringParam(params.status);
  const q = stringParam(params.q)?.slice(0, 100);

  const refs = db ? await loadQuestionRefs(db) : { subjects: [], topics: [], groups: [] };

  type Row = { id: string; subject_id: number; topic_id: string | null; group_id: string | null; type: string; locale: string; difficulty: number; stem: string; is_active: boolean; source: string | null };
  let rows: Row[] = [];
  let total = 0;
  const accuracy = new Map<string, { total: number; correct: number }>();

  if (db) {
    let query = db
      .from("questions")
      .select("id, subject_id, topic_id, group_id, type, locale, difficulty, stem, is_active, source", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (subject) query = query.eq("subject_id", subject);
    if (topic && UUID_RE.test(topic)) query = query.eq("topic_id", topic);
    if (type === "single" || type === "multiple") query = query.eq("type", type);
    if (type === "context") query = query.not("group_id", "is", null);
    if (locale === "kk" || locale === "ru") query = query.eq("locale", locale);
    if (status === "active") query = query.eq("is_active", true);
    if (status === "inactive") query = query.eq("is_active", false);
    if (q) query = query.ilike("stem", `%${q}%`);

    const { data, count } = await query;
    rows = (data ?? []) as Row[];
    total = count ?? 0;
    if (rows.length) {
      const { data: acc } = await db.rpc("admin_question_accuracy", { p_ids: rows.map((r) => r.id) });
      for (const a of acc ?? []) accuracy.set(a.question_id, { total: Number(a.total), correct: Number(a.correct) });
    }
  }

  const subjectTitle = (id: number) => refs.subjects.find((s) => s.id === id)?.title ?? "";
  const topicTitle = (id: string | null) => refs.topics.find((t) => t.id === id)?.title;
  const topicsForFilter = subject ? refs.topics.filter((t) => t.subject_id === subject) : refs.topics;

  return (
    <>
      <AdminHeader
        title="Сұрақтар банкі"
        description={`Барлығы табылды: ${total}. Сұрақты ашып өңдеңіз; статистика — оқушылардың дұрыс жауап үлесі.`}
        actions={
          <>
            <Link href="/admin/questions/groups" className="flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold hover:bg-muted">
              <Layers className="size-4" aria-hidden /> Контекстік мәтіндер
            </Link>
            <Link href="/admin/questions/import" className="flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold hover:bg-muted">
              <FileUp className="size-4" aria-hidden /> Импорт (мәтін / Excel)
            </Link>
            <Link
              href={`/admin/questions/new${subject ? `?subject=${subject}` : ""}`}
              className="flex h-10 items-center gap-2 rounded-xl bg-brand-gradient px-4 text-sm font-semibold text-white"
            >
              <Plus className="size-4" aria-hidden /> Жаңа сұрақ
            </Link>
          </>
        }
      />

      <Panel>
        <form className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <input name="q" defaultValue={q} placeholder="Мәтіннен іздеу" aria-label="Іздеу" className={`${inputClass} lg:col-span-2`} />
          <select name="subject" defaultValue={subject ?? ""} aria-label="Пән" className={inputClass}>
            <option value="">Барлық пән</option>
            {refs.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <select name="topic" defaultValue={topic ?? ""} aria-label="Тақырып" className={inputClass}>
            <option value="">Барлық тақырып</option>
            {topicsForFilter.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <select name="type" defaultValue={type ?? ""} aria-label="Түрі" className={inputClass}>
            <option value="">Барлық түр</option>
            <option value="single">Бір жауап</option>
            <option value="multiple">Көп жауап</option>
            <option value="context">Контекстік</option>
          </select>
          <select name="locale" defaultValue={locale ?? ""} aria-label="Тіл" className={inputClass}>
            <option value="">Екі тіл</option>
            <option value="kk">Қазақша</option>
            <option value="ru">Орысша</option>
          </select>
          <div className="flex gap-2">
            <select name="status" defaultValue={status ?? ""} aria-label="Күйі" className={inputClass}>
              <option value="">Барлығы</option>
              <option value="active">Белсенді</option>
              <option value="inactive">Өшірулі</option>
            </select>
            <button type="submit" className="h-10 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
              Сүзу
            </button>
          </div>
        </form>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Сұрақ табылмады.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const acc = accuracy.get(r.id);
              const percent = acc && acc.total ? Math.round((acc.correct / acc.total) * 100) : null;
              return (
                <li key={r.id}>
                  <Link href={`/admin/questions/${r.id}`} className="flex items-center gap-3 py-3 hover:text-primary">
                    <span className="min-w-0 flex-1">
                      <span className={r.is_active ? "block truncate text-sm font-semibold" : "block truncate text-sm font-semibold text-muted-foreground line-through"}>
                        {plainSnippet(r.stem, 140)}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                        <span>{subjectTitle(r.subject_id)}</span>
                        {topicTitle(r.topic_id) && <span>· {topicTitle(r.topic_id)}</span>}
                        <span>· {r.locale}</span>
                        <span>· қиындық {r.difficulty}</span>
                        {r.source?.startsWith("import:") && <span>· импорт</span>}
                      </span>
                    </span>
                    <span className="hidden gap-1 sm:flex">
                      {r.type === "multiple" && <Badge variant="secondary">Көп жауап</Badge>}
                      {r.group_id && <Badge variant="outline">Контекст</Badge>}
                    </span>
                    <span className="w-16 shrink-0 text-right text-sm tabular-nums" title={acc ? `${acc.total} жауап` : "Жауап жоқ"}>
                      {percent == null ? "—" : <span className={percent < 40 ? "font-bold text-danger" : "font-bold"}>{percent}%</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pager
          page={page}
          hasNext={page * PAGE_SIZE < total}
          params={{ q, subject: subject ? String(subject) : undefined, topic, type, locale, status }}
          basePath="/admin/questions"
        />
      </Panel>
    </>
  );
}
