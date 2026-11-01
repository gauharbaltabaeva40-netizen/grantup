"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Eye, EyeOff, Film, Gift, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createLesson, deleteLesson, deleteTopic, moveContent, saveTopic, updateSubject } from "@/lib/admin/content-actions";
import { cn } from "@/lib/utils";
import { inputClass } from "./ui";
import { useAdminAction } from "./use-admin-action";

export type AdminSubject = { id: number; code: string; title_kk: string; title_ru: string; color: string | null };
export type AdminLessonRow = {
  id: string;
  title_kk: string;
  is_free: boolean;
  is_published: boolean;
  hasVideo: boolean;
};
export type AdminTopic = { id: string; title_kk: string; title_ru: string; is_published: boolean; lessons: AdminLessonRow[]; questions: number };

export function SubjectForm({ subject }: { subject: AdminSubject }) {
  const { pending, run } = useAdminAction();
  const [values, setValues] = useState({ title_kk: subject.title_kk, title_ru: subject.title_ru, color: subject.color ?? "#0047ff" });

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateSubject({ id: subject.id, ...values }), "Пән сақталды");
      }}
    >
      <label className="min-w-48 flex-1 space-y-1 text-xs font-semibold text-muted-foreground">
        Атауы (қаз)
        <input className={inputClass} value={values.title_kk} onChange={(e) => setValues({ ...values, title_kk: e.target.value })} required />
      </label>
      <label className="min-w-48 flex-1 space-y-1 text-xs font-semibold text-muted-foreground">
        Атауы (орыс)
        <input className={inputClass} value={values.title_ru} onChange={(e) => setValues({ ...values, title_ru: e.target.value })} required />
      </label>
      <label className="space-y-1 text-xs font-semibold text-muted-foreground">
        Түсі
        <input
          type="color"
          className="block h-10 w-14 cursor-pointer rounded-xl border border-input bg-card p-1"
          value={values.color}
          onChange={(e) => setValues({ ...values, color: e.target.value })}
        />
      </label>
      <Button type="submit" variant="outline" className="h-10" disabled={pending}>
        Сақтау
      </Button>
    </form>
  );
}

function MoveButtons({ kind, id, first, last }: { kind: "topic" | "lesson"; id: string; first: boolean; last: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <span className="flex shrink-0">
      <Button variant="ghost" size="icon-sm" aria-label="Жоғары" disabled={pending || first} onClick={() => run(() => moveContent(kind, id, -1))}>
        <ArrowUp aria-hidden />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Төмен" disabled={pending || last} onClick={() => run(() => moveContent(kind, id, 1))}>
        <ArrowDown aria-hidden />
      </Button>
    </span>
  );
}

export function TopicBlock({ topic, subjectId, first, last }: { topic: AdminTopic; subjectId: number; first: boolean; last: boolean }) {
  const { pending, run } = useAdminAction();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ title_kk: topic.title_kk, title_ru: topic.title_ru });

  const save = (patch: Partial<{ title_kk: string; title_ru: string; is_published: boolean }>, message: string) =>
    run(
      () => saveTopic({ id: topic.id, subject_id: subjectId, title_kk: topic.title_kk, title_ru: topic.title_ru, is_published: topic.is_published, ...patch }),
      message,
      () => setEditing(false),
    );

  return (
    <section className={cn("rounded-2xl border bg-card", !topic.is_published && "border-dashed opacity-80")}>
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <MoveButtons kind="topic" id={topic.id} first={first} last={last} />
        {editing ? (
          <form
            className="flex min-w-0 flex-1 flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save(values, "Тақырып сақталды");
            }}
          >
            <input aria-label="Атауы (қаз)" className={`${inputClass} min-w-40 flex-1`} value={values.title_kk} onChange={(e) => setValues({ ...values, title_kk: e.target.value })} required />
            <input aria-label="Атауы (орыс)" className={`${inputClass} min-w-40 flex-1`} value={values.title_ru} onChange={(e) => setValues({ ...values, title_ru: e.target.value })} required />
            <Button type="submit" className="h-10" disabled={pending}>
              Сақтау
            </Button>
            <Button type="button" variant="ghost" className="h-10" onClick={() => setEditing(false)}>
              Болдырмау
            </Button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-bold">{topic.title_kk}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {topic.title_ru} · {topic.lessons.length} сабақ · {topic.questions} сұрақ
              </p>
            </div>
            {!topic.is_published && <Badge variant="outline">Жасырын</Badge>}
            <Button variant="ghost" size="icon-sm" aria-label="Өңдеу" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={topic.is_published ? "Жасыру" : "Жариялау"}
              disabled={pending}
              onClick={() => save({ is_published: !topic.is_published }, topic.is_published ? "Тақырып жасырылды" : "Тақырып жарияланды")}
            >
              {topic.is_published ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Өшіру"
              disabled={pending}
              onClick={() => confirm(`«${topic.title_kk}» тақырыбын өшіру керек пе?`) && run(() => deleteTopic(topic.id), "Тақырып өшірілді")}
            >
              <Trash2 aria-hidden className="text-danger" />
            </Button>
          </>
        )}
      </header>

      <ul className="divide-y">
        {topic.lessons.map((lesson, i) => (
          <LessonRow key={lesson.id} lesson={lesson} first={i === 0} last={i === topic.lessons.length - 1} />
        ))}
      </ul>
      <AddLessonForm topicId={topic.id} />
    </section>
  );
}

function LessonRow({ lesson, first, last }: { lesson: AdminLessonRow; first: boolean; last: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <li className="flex items-center gap-2 px-4 py-2">
      <MoveButtons kind="lesson" id={lesson.id} first={first} last={last} />
      <Link href={`/admin/content/lessons/${lesson.id}`} className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-primary">
        {lesson.title_kk}
      </Link>
      <span className="hidden items-center gap-1 sm:flex">
        {lesson.is_free && (
          <Badge variant="secondary">
            <Gift aria-hidden /> Тегін
          </Badge>
        )}
        {!lesson.hasVideo && (
          <Badge variant="outline">
            <Film aria-hidden /> Видео жоқ
          </Badge>
        )}
        {!lesson.is_published && <Badge variant="outline">Жарияланбаған</Badge>}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Өшіру"
        disabled={pending}
        onClick={() => confirm(`«${lesson.title_kk}» сабағын өшіру керек пе?`) && run(() => deleteLesson(lesson.id), "Сабақ өшірілді")}
      >
        <Trash2 aria-hidden className="text-danger" />
      </Button>
    </li>
  );
}

function AddLessonForm({ topicId }: { topicId: string }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ title_kk: "", title_ru: "" });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-muted/50">
        <Plus className="size-4" aria-hidden /> Сабақ қосу
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap gap-2 border-t px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createLesson({ topic_id: topicId, ...values }), "Сабақ жасалды", (data) => data && router.push(`/admin/content/lessons/${data.id}`));
      }}
    >
      <input aria-label="Сабақ атауы (қаз)" placeholder="Атауы (қаз)" className={`${inputClass} min-w-40 flex-1`} value={values.title_kk} onChange={(e) => setValues({ ...values, title_kk: e.target.value })} required />
      <input aria-label="Сабақ атауы (орыс)" placeholder="Атауы (орыс)" className={`${inputClass} min-w-40 flex-1`} value={values.title_ru} onChange={(e) => setValues({ ...values, title_ru: e.target.value })} required />
      <Button type="submit" className="h-10" disabled={pending}>
        Қосу
      </Button>
      <Button type="button" variant="ghost" className="h-10" onClick={() => setOpen(false)}>
        Болдырмау
      </Button>
    </form>
  );
}

export function AddTopicForm({ subjectId }: { subjectId: number }) {
  const { pending, run } = useAdminAction();
  const [values, setValues] = useState({ title_kk: "", title_ru: "" });
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveTopic({ subject_id: subjectId, ...values, is_published: true }), "Тақырып қосылды", () => setValues({ title_kk: "", title_ru: "" }));
      }}
    >
      <input aria-label="Тақырып атауы (қаз)" placeholder="Жаңа тақырып (қаз)" className={`${inputClass} min-w-48 flex-1`} value={values.title_kk} onChange={(e) => setValues({ ...values, title_kk: e.target.value })} required />
      <input aria-label="Тақырып атауы (орыс)" placeholder="Жаңа тақырып (орыс)" className={`${inputClass} min-w-48 flex-1`} value={values.title_ru} onChange={(e) => setValues({ ...values, title_ru: e.target.value })} required />
      <Button type="submit" variant="brand" className="h-10" disabled={pending}>
        <Plus aria-hidden /> Тақырып қосу
      </Button>
    </form>
  );
}
