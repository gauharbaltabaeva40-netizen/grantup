import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminHeader, Panel, Stat } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { adminPage, formatDateTime } from "@/lib/admin/server";
import { signedProctoringImages } from "@/lib/proctoring/server";
import type { ProctoringEventType } from "@/lib/supabase/types";

export const metadata = { title: "Прокторинг · сынақ" };
export const dynamic = "force-dynamic";

const EVENT: Record<ProctoringEventType, { label: string; tone: "destructive" | "secondary" | "outline" }> = {
  consent: { label: "Келісім, камера қосылды", tone: "outline" },
  snapshot: { label: "Кезекті фото", tone: "outline" },
  no_face: { label: "Бет көрінбейді", tone: "destructive" },
  multiple_faces: { label: "Бірнеше адам", tone: "destructive" },
  camera_off: { label: "Камера өшті", tone: "secondary" },
  tab_hidden: { label: "Басқа бетке ауысты", tone: "secondary" },
  detector_unavailable: { label: "Бет анықтау қолжетімсіз (тек фото)", tone: "outline" },
};

export default async function AdminProctoringAttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const db = await adminPage();
  if (!db || !/^[0-9a-f-]{36}$/i.test(attemptId)) notFound();

  const { data: attempt } = await db
    .from("attempts")
    .select("id, user_id, kind, status, score, max_score, started_at, finished_at")
    .eq("id", attemptId)
    .eq("kind", "mock")
    .maybeSingle();
  if (!attempt) notFound();

  const [{ data: profile }, { data: events }] = await Promise.all([
    db.from("profiles").select("full_name, email").eq("id", attempt.user_id).maybeSingle(),
    db.from("proctoring_events").select("id, type, detail, image_path, created_at").eq("attempt_id", attemptId).order("created_at").limit(1000),
  ]);
  const list = events ?? [];
  const images = await signedProctoringImages(list.map((e) => e.image_path).filter((p): p is string => Boolean(p)));
  const count = (type: ProctoringEventType) => list.filter((e) => e.type === type).length;
  const scaled = attempt.score != null && attempt.max_score ? Math.round((Number(attempt.score) / Number(attempt.max_score)) * 140) : null;

  return (
    <div className="space-y-5">
      <Link href="/admin/proctoring" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Прокторинг
      </Link>
      <AdminHeader
        title={profile?.full_name || profile?.email || "Оқушы"}
        description={`Сынақ ҰБТ · ${formatDateTime(attempt.started_at)} – ${formatDateTime(attempt.finished_at)}${scaled != null ? ` · ${scaled}/140` : ""}`}
        actions={
          <Link href={`/admin/students/${attempt.user_id}`} className="text-sm font-semibold text-primary">
            Оқушы беті →
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Бет көрінбеді" value={count("no_face")} tone={count("no_face") ? "warn" : undefined} />
        <Stat label="Бірнеше адам" value={count("multiple_faces")} tone={count("multiple_faces") ? "warn" : undefined} />
        <Stat label="Басқа бетке ауысу" value={count("tab_hidden")} tone={count("tab_hidden") ? "warn" : undefined} />
        <Stat label="Камера өшті" value={count("camera_off")} tone={count("camera_off") ? "warn" : undefined} />
      </div>

      <Panel title="Фотолар">
        {images.size === 0 ? (
          <p className="text-sm text-muted-foreground">Фото жоқ.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list
              .filter((e) => e.image_path && images.has(e.image_path))
              .map((e) => (
                <figure key={e.id} className="overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- қысқа мерзімді signed URL */}
                  <img src={images.get(e.image_path!)} alt={EVENT[e.type].label} className="aspect-[4/3] w-full bg-black object-cover" loading="lazy" />
                  <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                    <Badge variant={EVENT[e.type].tone}>{EVENT[e.type].label}</Badge>
                    <span className="tabular-nums text-muted-foreground">{formatDateTime(e.created_at).split(", ")[1]}</span>
                  </figcaption>
                </figure>
              ))}
          </div>
        )}
      </Panel>

      <Panel title="Оқиғалар журналы">
        <ol className="divide-y text-sm">
          {list.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2">
              <Badge variant={EVENT[e.type].tone}>{EVENT[e.type].label}</Badge>
              <span className="tabular-nums text-muted-foreground">{formatDateTime(e.created_at)}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
