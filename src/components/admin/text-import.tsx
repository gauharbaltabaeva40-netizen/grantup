"use client";

/**
 * Мәтіннен импорт: Word/PDF-тен көшірілген тестті қою → сұрақтарға бөлу → дұрыс жауапты басып белгілеу → сақтау.
 * Сақтау Excel импортымен бірдей серверлік әрекет арқылы (сервер әр сұрақты қайта тексереді).
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListChecks, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { importQuestions } from "@/lib/admin/question-actions";
import { OPTION_LETTERS } from "@/lib/admin/question-import";
import { parseTestText } from "@/lib/admin/text-import";
import { cn } from "@/lib/utils";
import { useAdminAction } from "./use-admin-action";

type Draft = {
  key: string;
  number: number | null;
  stem: string;
  options: string[];
  correct: number[];
  type: "single" | "multiple";
  difficulty: 1 | 2 | 3;
  explanation: string;
};

type Subject = { code: string; title: string; topics: string[] };

const MAX_SAVE = 500;
const PLACEHOLDER = `1. Зарина патшайым басқарған мемлекет
A) Үйсін
B) Қаңлы
C) Қарлұқ
D) Сақ

2. …

Жауаптар: 1-D 2-B …   (міндетті емес — дұрыс жауапты төменде басып белгілей аласыз)`;

const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40";

function problems(d: Draft) {
  const list: string[] = [];
  if (!d.stem.trim()) list.push("сұрақ мәтіні бос");
  if (d.options.filter((o) => o.trim()).length < 2) list.push("кемінде 2 нұсқа керек");
  if (d.options.some((o) => !o.trim())) list.push("бос нұсқа бар");
  if (d.correct.length === 0) list.push("дұрыс жауап белгіленбеген");
  if (d.type === "single" && d.correct.length > 1) list.push("бір жауапты сұрақта 1 дұрыс жауап болады");
  return list;
}

export function TextImport({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [subject, setSubject] = useState(subjects[0]?.code ?? "");
  const [topic, setTopic] = useState("");
  const [locale, setLocale] = useState<"kk" | "ru">("kk");
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [skipped, setSkipped] = useState(0);

  const topics = subjects.find((s) => s.code === subject)?.topics ?? [];
  const invalid = useMemo(() => (drafts ?? []).filter((d) => problems(d).length > 0).length, [drafts]);

  const analyse = () => {
    const result = parseTestText(text);
    setSkipped(result.skipped.length);
    setDrafts(
      result.questions.map((q, i) => ({
        key: `${i}-${q.number ?? "x"}`,
        number: q.number,
        stem: q.stem,
        options: q.options.slice(0, OPTION_LETTERS.length),
        correct: q.correct,
        // ҰБТ: бірнеше жауапты тапсырмада 6 нұсқа болады
        type: q.correct.length > 1 || q.options.length === 6 ? "multiple" : "single",
        difficulty,
        explanation: "",
      })),
    );
  };

  const update = (key: string, patch: Partial<Draft> | ((d: Draft) => Partial<Draft>)) =>
    setDrafts((list) => list?.map((d) => (d.key === key ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) } : d)) ?? null);

  const toggleCorrect = (d: Draft, index: number) =>
    update(d.key, {
      correct:
        d.type === "single"
          ? [index]
          : d.correct.includes(index)
            ? d.correct.filter((i) => i !== index)
            : [...d.correct, index].sort((a, b) => a - b),
    });

  const save = () => {
    if (!drafts?.length || invalid > 0) return;
    const rows = drafts.slice(0, MAX_SAVE).map((d) => ({
      subject,
      topic: topic || "",
      locale,
      type: d.type,
      difficulty: d.difficulty,
      stem: d.stem.trim(),
      ...Object.fromEntries(d.options.map((o, i) => [OPTION_LETTERS[i], o.trim()])),
      correct: d.correct.map((i) => OPTION_LETTERS[i]).join(","),
      explanation: d.explanation.trim(),
    }));
    run(
      () => importQuestions({ fileName: "мәтіннен", rows }),
      `${rows.length} сұрақ сақталды`,
      () => {
        setDrafts(null);
        setText("");
        router.refresh();
      },
    );
  };

  return (
    <div className="space-y-5">
      {/* Баптаулар */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm font-semibold">
          Пән
          <select className={field} value={subject} onChange={(e) => (setSubject(e.target.value), setTopic(""))}>
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Тақырып (міндетті емес)
          <select className={field} value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">— жоқ —</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Тіл
          <select className={field} value={locale} onChange={(e) => setLocale(e.target.value as "kk" | "ru")}>
            <option value="kk">Қазақша</option>
            <option value="ru">Орысша</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold">
          Қиындық (әдепкі)
          <select className={field} value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3)}>
            <option value={1}>A — базалық</option>
            <option value={2}>B — орташа</option>
            <option value={3}>C — жоғары</option>
          </select>
        </label>
      </div>

      {/* Мәтін */}
      <div className="space-y-2">
        <textarea
          className={cn(field, "min-h-64 font-mono text-[13px] leading-relaxed")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          aria-label="Тест мәтіні"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="brand" size="lg" onClick={analyse} disabled={!text.trim()}>
            <Sparkles aria-hidden /> Сұрақтарға бөлу
          </Button>
          <p className="text-xs text-muted-foreground">
            Word немесе PDF-тен тестті сол күйінде көшіріп қойыңыз. Формулалар PDF-тен көшкенде бұзылуы мүмкін — алдын ала қарауда түзетіңіз (KaTeX:
            <code className="mx-1">$x^2$</code>).
          </p>
        </div>
      </div>

      {/* Алдын ала қарау */}
      {drafts && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
            <ListChecks className="size-4 text-primary" aria-hidden />
            <b>{drafts.length} сұрақ табылды</b>
            {invalid > 0 ? <Badge variant="destructive">{invalid} сұрақты толықтыру керек</Badge> : drafts.length > 0 && <Badge variant="outline">Бәрі дайын</Badge>}
            {skipped > 0 && <span className="text-xs text-muted-foreground">· {skipped} қызметтік жол өткізілді (нұсқау, тақырып)</span>}
            {invalid > 0 && (
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDrafts((list) => list?.filter((d) => problems(d).length === 0) ?? null)}>
                <Trash2 aria-hidden /> Толық еместерін алып тастау
              </Button>
            )}
          </div>

          {drafts.length === 0 && <p className="text-sm text-muted-foreground">Сұрақ табылмады. Әр сұрақ нөмірмен («1.»), нұсқалар «A)» деп басталуы керек.</p>}

          <ol className="space-y-3">
            {drafts.map((d, i) => {
              const issues = problems(d);
              return (
                <li key={d.key} className={cn("rounded-2xl border p-4", issues.length ? "border-danger/40 bg-danger/5" : "bg-card")}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <b>
                      {i + 1}-сұрақ{d.number !== null && d.number !== i + 1 ? ` (мәтінде №${d.number})` : ""}
                    </b>
                    <div className="flex rounded-lg border p-0.5 text-xs font-semibold">
                      {(["single", "multiple"] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => update(d.key, (cur) => ({ type, correct: type === "single" ? cur.correct.slice(0, 1) : cur.correct }))}
                          className={cn("rounded-md px-2 py-1", d.type === type ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                        >
                          {type === "single" ? "Бір жауап" : "Бірнеше жауап"}
                        </button>
                      ))}
                    </div>
                    <select
                      className="rounded-lg border bg-background px-2 py-1 text-xs font-semibold"
                      value={d.difficulty}
                      onChange={(e) => update(d.key, { difficulty: Number(e.target.value) as 1 | 2 | 3 })}
                      aria-label="Қиындық"
                    >
                      <option value={1}>A</option>
                      <option value={2}>B</option>
                      <option value={3}>C</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-danger"
                      onClick={() => setDrafts((list) => list?.filter((x) => x.key !== d.key) ?? null)}
                    >
                      <Trash2 aria-hidden /> Өшіру
                    </Button>
                  </div>

                  <textarea
                    className={cn(field, "min-h-16")}
                    rows={Math.min(8, d.stem.split("\n").length + 1)}
                    value={d.stem}
                    onChange={(e) => update(d.key, { stem: e.target.value })}
                    aria-label="Сұрақ мәтіні"
                  />

                  <p className="mt-3 mb-1.5 text-xs font-semibold text-muted-foreground">Дұрыс жауапты әріпті басып белгілеңіз:</p>
                  <ul className="space-y-1.5">
                    {d.options.map((option, k) => {
                      const correct = d.correct.includes(k);
                      return (
                        <li key={k} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCorrect(d, k)}
                            aria-pressed={correct}
                            aria-label={`${OPTION_LETTERS[k]} — дұрыс жауап`}
                            className={cn(
                              "grid size-8 shrink-0 place-items-center text-sm font-bold transition-colors",
                              d.type === "single" ? "rounded-full" : "rounded-lg",
                              correct ? "bg-success text-white" : "border bg-background text-muted-foreground hover:border-success hover:text-success",
                            )}
                          >
                            {correct ? <Check className="size-4" strokeWidth={3} /> : OPTION_LETTERS[k]}
                          </button>
                          <input
                            className={field}
                            value={option}
                            onChange={(e) => update(d.key, (cur) => ({ options: cur.options.map((o, j) => (j === k ? e.target.value : o)) }))}
                            aria-label={`${OPTION_LETTERS[k]} нұсқасы`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              update(d.key, (cur) => ({
                                options: cur.options.filter((_, j) => j !== k),
                                correct: cur.correct.filter((c) => c !== k).map((c) => (c > k ? c - 1 : c)),
                              }))
                            }
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-danger"
                            aria-label={`${OPTION_LETTERS[k]} нұсқасын өшіру`}
                          >
                            <X className="size-4" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {d.options.length < OPTION_LETTERS.length && (
                    <Button variant="ghost" size="sm" className="mt-1" onClick={() => update(d.key, (cur) => ({ options: [...cur.options, ""] }))}>
                      <Plus aria-hidden /> Нұсқа қосу
                    </Button>
                  )}

                  <textarea
                    className={cn(field, "mt-2 min-h-10")}
                    rows={1}
                    value={d.explanation}
                    onChange={(e) => update(d.key, { explanation: e.target.value })}
                    placeholder="Қысқа түсіндірме (міндетті емес) — оқушы қате жауап бергенде көрінеді"
                    aria-label="Түсіндірме"
                  />

                  {issues.length > 0 && <p className="mt-2 text-xs font-semibold text-danger">{issues.join(" · ")}</p>}
                </li>
              );
            })}
          </ol>

          {drafts.length > 0 && (
            <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur">
              <p className="text-sm">
                {invalid > 0 ? (
                  <span className="font-semibold text-danger">Сақтау үшін {invalid} сұрақты толықтырыңыз немесе алып тастаңыз.</span>
                ) : (
                  <span className="font-semibold">{Math.min(drafts.length, MAX_SAVE)} сұрақ сақтауға дайын.</span>
                )}
              </p>
              <Button variant="brand" size="lg" className="ml-auto" onClick={save} disabled={pending || invalid > 0 || !subject}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                Сақтау
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
