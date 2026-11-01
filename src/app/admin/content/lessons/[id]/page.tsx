import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LessonEditor } from "@/components/admin/lesson-editor";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { adminPage } from "@/lib/admin/server";

export const metadata = { title: "Сабақты өңдеу" };
export const dynamic = "force-dynamic";

export default async function AdminLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await adminPage();
  if (!db || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: lesson } = await db.from("lessons").select("*").eq("id", id).maybeSingle();
  if (!lesson) notFound();

  const [{ data: content }, { data: video }, { data: topic }] = await Promise.all([
    db.from("lesson_contents").select("summary_kk, summary_ru").eq("lesson_id", id).maybeSingle(),
    db.from("lesson_videos").select("youtube_id").eq("lesson_id", id).maybeSingle(),
    db.from("topics").select("subject_id").eq("id", lesson.topic_id).single(),
  ]);
  const [{ data: topics }, { data: subject }, { count: questions }] = await Promise.all([
    db.from("topics").select("id, title_kk").eq("subject_id", topic?.subject_id ?? 0).order("position"),
    db.from("subjects").select("code, title_kk").eq("id", topic?.subject_id ?? 0).maybeSingle(),
    db.from("questions").select("id", { count: "exact", head: true }).eq("topic_id", lesson.topic_id).eq("is_active", true),
  ]);

  return (
    <div className="space-y-5">
      <Link
        href={`/admin/content?subject=${subject?.code ?? ""}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> {subject?.title_kk ?? "Контент"}
      </Link>
      <AdminHeader
        title={lesson.title_kk}
        description={`Сабақ тесті осы тақырыптың белсенді сұрақтарынан құралады: қазір ${questions ?? 0} сұрақ.`}
        actions={
          <Link href={`/admin/questions?topic=${lesson.topic_id}`} className="text-sm font-semibold text-primary">
            Тақырып сұрақтары →
          </Link>
        }
      />
      <Panel>
        <LessonEditor
          initial={{
            id: lesson.id,
            topic_id: lesson.topic_id,
            title_kk: lesson.title_kk,
            title_ru: lesson.title_ru,
            is_free: lesson.is_free,
            is_published: lesson.is_published,
            duration_seconds: lesson.duration_seconds,
            xp_reward: lesson.xp_reward,
            youtube: video?.youtube_id ?? "",
            summary_kk: content?.summary_kk ?? "",
            summary_ru: content?.summary_ru ?? "",
          }}
          topics={(topics ?? []).map((t) => ({ id: t.id, title: t.title_kk }))}
        />
      </Panel>
    </div>
  );
}
