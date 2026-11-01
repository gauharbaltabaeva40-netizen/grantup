import Link from "next/link";
import { AddTopicForm, type AdminTopic, SubjectForm, TopicBlock } from "@/components/admin/content-editor";
import { AdminHeader, Panel } from "@/components/admin/ui";
import { adminPage, stringParam } from "@/lib/admin/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Контент" };
export const dynamic = "force-dynamic";

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const db = await adminPage();
  const code = stringParam((await searchParams).subject);

  const subjects = db ? ((await db.from("subjects").select("id, code, title_kk, title_ru, color").order("position")).data ?? []) : [];
  const subject = subjects.find((s) => s.code === code) ?? subjects[0];

  let topics: AdminTopic[] = [];
  if (db && subject) {
    const { data: topicRows } = await db
      .from("topics")
      .select("id, title_kk, title_ru, is_published")
      .eq("subject_id", subject.id)
      .order("position")
      .order("created_at");
    const topicIds = (topicRows ?? []).map((t) => t.id);
    const [{ data: lessons }, { data: videos }, { data: questions }] = topicIds.length
      ? await Promise.all([
          db.from("lessons").select("id, topic_id, title_kk, is_free, is_published").in("topic_id", topicIds).order("position").order("created_at"),
          db.from("lesson_videos").select("lesson_id"),
          db.from("questions").select("topic_id").eq("subject_id", subject.id).eq("is_active", true),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
    const withVideo = new Set((videos ?? []).map((v) => v.lesson_id));

    topics = (topicRows ?? []).map((t) => ({
      ...t,
      questions: (questions ?? []).filter((q) => q.topic_id === t.id).length,
      lessons: (lessons ?? [])
        .filter((l) => l.topic_id === t.id)
        .map((l) => ({ ...l, hasVideo: withVideo.has(l.id) })),
    }));
  }

  return (
    <>
      <AdminHeader title="Контент" description="Пәндер → тақырыптар → сабақтар. Ретін көрсеткілермен өзгертіңіз; сабақты ашып видео мен конспектіні толтырыңыз." />

      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {subjects.map((s) => (
          <Link
            key={s.id}
            href={`/admin/content?subject=${s.code}`}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold hover:bg-muted",
              s.id === subject?.id && "border-primary bg-secondary text-primary hover:bg-secondary",
            )}
          >
            {s.title_kk}
          </Link>
        ))}
      </nav>

      {!subject ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Пәндер жоқ — алдымен миграциялар мен seed.sql іске қосылуы керек.</p>
        </Panel>
      ) : (
        <div className="space-y-4">
          <Panel title="Пән">
            <SubjectForm key={subject.id} subject={subject} />
          </Panel>
          {topics.map((topic, i) => (
            <TopicBlock key={topic.id} topic={topic} subjectId={subject.id} first={i === 0} last={i === topics.length - 1} />
          ))}
          <Panel title="Жаңа тақырып">
            <AddTopicForm subjectId={subject.id} />
          </Panel>
        </div>
      )}
    </>
  );
}
