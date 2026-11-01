"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Markdown } from "@/components/content/markdown";
import { Button } from "@/components/ui/button";
import { deleteQuestion, deleteQuestionGroup, type QuestionInput, saveQuestion, saveQuestionGroup } from "@/lib/admin/question-actions";
import { OPTION_LETTERS } from "@/lib/admin/question-import";
import { cn } from "@/lib/utils";
import { ImageUpload } from "./image-upload";
import { MarkdownField } from "./lesson-editor";
import { inputClass } from "./ui";
import { useAdminAction } from "./use-admin-action";

export type RefData = {
  subjects: { id: number; title: string }[];
  topics: { id: string; subject_id: number; title: string }[];
  groups: { id: string; subject_id: number; locale: "kk" | "ru"; title: string }[];
};

type Option = { id?: string; content: string; is_correct: boolean };
type Values = Omit<QuestionInput, "options"> & { options: Option[] };

const MD_HINT = "Markdown + формула: $x^2$, $$\\sqrt{2}$$, кесте | a | b |";
const labelClass = "space-y-1 text-xs font-semibold text-muted-foreground";

export function QuestionEditor({ initial, imageUrl, refs }: { initial: Values; imageUrl: string | null; refs: RefData }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState<Values>(initial);
  const [image, setImage] = useState(imageUrl);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((prev) => ({ ...prev, [key]: value }));

  const topics = refs.topics.filter((t) => t.subject_id === v.subject_id);
  const groups = refs.groups.filter((g) => g.subject_id === v.subject_id && g.locale === v.locale);
  const correctCount = v.options.filter((o) => o.is_correct).length;
  const correctOk = v.type === "single" ? correctCount === 1 : correctCount >= 1;

  function setOption(index: number, patch: Partial<Option>) {
    setV((prev) => ({
      ...prev,
      options: prev.options.map((o, i) =>
        i === index ? { ...o, ...patch } : patch.is_correct && prev.type === "single" ? { ...o, is_correct: false } : o,
      ),
    }));
  }

  return (
    <form
      className="grid gap-6 xl:grid-cols-[1fr_380px]"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveQuestion(v), "Сұрақ сақталды", (data) => {
          if (!v.id && data) router.replace(`/admin/questions/${data.id}`);
          else router.refresh();
        });
      }}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={labelClass}>
            Пән
            <select
              className={inputClass}
              value={v.subject_id}
              onChange={(e) => setV({ ...v, subject_id: Number(e.target.value), topic_id: null, group_id: null })}
            >
              {refs.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Тақырып
            <select className={inputClass} value={v.topic_id ?? ""} onChange={(e) => set("topic_id", e.target.value || null)}>
              <option value="">— тақырыпсыз —</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Тіл
            <select className={inputClass} value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value as "kk" | "ru", group_id: null })}>
              <option value="kk">Қазақша</option>
              <option value="ru">Орысша</option>
            </select>
          </label>
          <label className={labelClass}>
            Түрі
            <select
              className={inputClass}
              value={v.type}
              onChange={(e) => {
                const type = e.target.value as "single" | "multiple";
                // Бір жауаптыға ауысқанда тек бірінші дұрыс нұсқа қалады
                const first = v.options.findIndex((o) => o.is_correct);
                setV({
                  ...v,
                  type,
                  options: type === "single" ? v.options.map((o, i) => ({ ...o, is_correct: i === first })) : v.options,
                });
              }}
            >
              <option value="single">Бір дұрыс жауап</option>
              <option value="multiple">Бірнеше дұрыс жауап</option>
            </select>
          </label>
          <label className={labelClass}>
            Қиындық
            <select className={inputClass} value={v.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))}>
              <option value={1}>1 — жеңіл</option>
              <option value={2}>2 — орташа</option>
              <option value={3}>3 — қиын</option>
            </select>
          </label>
          <label className={labelClass}>
            Контекстік мәтін
            <select className={inputClass} value={v.group_id ?? ""} onChange={(e) => set("group_id", e.target.value || null)}>
              <option value="">— жоқ (жеке сұрақ) —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <MarkdownField label="Сұрақ мәтіні" value={v.stem} onChange={(x) => set("stem", x)} rows={6} hint={MD_HINT} />
        <ImageUpload
          url={image}
          onChange={({ path, url }) => {
            set("image_path", path);
            setImage(url);
          }}
        />

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">
            Нұсқалар — дұрысын белгілеңіз {v.type === "single" ? "(дәл 1)" : "(кемінде 1)"}
          </legend>
          {v.options.map((o, i) => (
            <div key={o.id ?? `new-${i}`} className="flex items-start gap-2">
              <label className={cn("mt-2 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold", o.is_correct && "border-success bg-success text-white")}>
                <input
                  type={v.type === "single" ? "radio" : "checkbox"}
                  name="correct"
                  className="sr-only"
                  checked={o.is_correct}
                  onChange={(e) => setOption(i, { is_correct: e.target.checked })}
                />
                {OPTION_LETTERS[i]}
              </label>
              <textarea
                aria-label={`${OPTION_LETTERS[i]} нұсқасы`}
                value={o.content}
                onChange={(e) => setOption(i, { content: e.target.value })}
                rows={1}
                required
                className="min-h-10 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-1"
                aria-label="Нұсқаны өшіру"
                disabled={v.options.length <= 2}
                onClick={() => set("options", v.options.filter((_, k) => k !== i))}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          {v.options.length < 8 && (
            <Button type="button" variant="ghost" className="text-primary" onClick={() => set("options", [...v.options, { content: "", is_correct: false }])}>
              <Plus aria-hidden /> Нұсқа қосу
            </Button>
          )}
          {!correctOk && <p className="text-sm font-semibold text-danger">Дұрыс жауапты белгілеңіз.</p>}
        </fieldset>

        <MarkdownField label="Түсіндірме (жауаптан кейін көрсетіледі)" value={v.explanation} onChange={(x) => set("explanation", x)} rows={5} />

        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-primary" checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          Белсенді (тесттерде қолданылады)
        </label>

        <div className="sticky bottom-0 -mx-5 flex flex-wrap gap-2 border-t bg-card/95 px-5 py-3 backdrop-blur">
          <Button type="submit" variant="brand" size="xl" disabled={pending || !correctOk}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Сақтау
          </Button>
          {v.id && (
            <Button
              type="button"
              variant="destructive"
              size="xl"
              disabled={pending}
              onClick={() =>
                confirm("Сұрақты біржола өшіру керек пе?") && run(() => deleteQuestion(v.id!), "Сұрақ өшірілді", () => router.replace("/admin/questions"))
              }
            >
              Өшіру
            </Button>
          )}
        </div>
      </div>

      {/* Оқушы көретін түрі */}
      <aside className="space-y-3 xl:sticky xl:top-36 xl:self-start">
        <p className="text-xs font-semibold text-muted-foreground">Оқушыға көрінісі</p>
        <div className="space-y-3 rounded-2xl border bg-background p-4">
          <Markdown>{v.stem || "_Сұрақ мәтіні_"}</Markdown>
          {/* eslint-disable-next-line @next/next/no-img-element -- қысқа мерзімді signed URL */}
          {image && <img src={image} alt="" className="max-h-48 rounded-xl" />}
          <ul className="space-y-2">
            {v.options.map((o, i) => (
              <li key={i} className={cn("flex gap-2 rounded-xl border bg-card px-3 py-2 text-sm", o.is_correct && "border-success")}>
                <span className="font-bold">{OPTION_LETTERS[i]}</span>
                <Markdown inline>{o.content || "…"}</Markdown>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </form>
  );
}

// ---------------------------------------------------------------------
// Контекстік мәтін редакторы
// ---------------------------------------------------------------------

export type GroupValues = {
  id?: string;
  subject_id: number;
  topic_id: string | null;
  locale: "kk" | "ru";
  title: string | null;
  passage: string;
  image_path: string | null;
};

export function GroupEditor({
  initial,
  imageUrl,
  refs,
  questions,
}: {
  initial: GroupValues;
  imageUrl: string | null;
  refs: Omit<RefData, "groups">;
  questions: number;
}) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const [image, setImage] = useState(imageUrl);
  const topics = refs.topics.filter((t) => t.subject_id === v.subject_id);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveQuestionGroup(v), "Мәтін сақталды", (data) => {
          if (!v.id && data) router.replace(`/admin/questions/groups/${data.id}`);
          else router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Атауы (тізімде көрінеді)
          <input className={inputClass} value={v.title ?? ""} onChange={(e) => setV({ ...v, title: e.target.value || null })} maxLength={200} />
        </label>
        <label className={labelClass}>
          Пән
          <select className={inputClass} value={v.subject_id} onChange={(e) => setV({ ...v, subject_id: Number(e.target.value), topic_id: null })}>
            {refs.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Тақырып
          <select className={inputClass} value={v.topic_id ?? ""} onChange={(e) => setV({ ...v, topic_id: e.target.value || null })}>
            <option value="">— тақырыпсыз —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Тіл
          <select className={inputClass} value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value as "kk" | "ru" })}>
            <option value="kk">Қазақша</option>
            <option value="ru">Орысша</option>
          </select>
        </label>
      </div>
      <MarkdownField label="Мәтін" value={v.passage} onChange={(passage) => setV({ ...v, passage })} rows={14} hint={MD_HINT} />
      <ImageUpload
        url={image}
        onChange={({ path, url }) => {
          setV({ ...v, image_path: path });
          setImage(url);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="brand" size="xl" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Сақтау
        </Button>
        {v.id && (
          <>
            <Link href={`/admin/questions/new?group=${v.id}`} className="px-3 text-sm font-semibold text-primary">
              Осы мәтінге сұрақ қосу ({questions})
            </Link>
            <Button
              type="button"
              variant="destructive"
              size="xl"
              disabled={pending}
              onClick={() => confirm("Мәтінді өшіру керек пе?") && run(() => deleteQuestionGroup(v.id!), "Мәтін өшірілді", () => router.replace("/admin/questions/groups"))}
            >
              Өшіру
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
