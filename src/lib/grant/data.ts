import "server-only";
import { cache } from "react";
import { getCurrentProfile } from "@/lib/auth/session";
import { getCatalog } from "@/lib/content/catalog";
import { localized } from "@/lib/content/localize";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { easiestGain, predictScore, type Prediction, type SubjectAccuracy } from "./predict";

export type WeakTopic = { topicId: string; title: string; subjectCode: string; subjectTitle: string; accuracy: number; answered: number };

export type GrantOverview = {
  prediction: Prediction | null;
  maxScore: number;
  target: number | null;
  specialty: { name: string; code: string; threshold: number } | null;
  /** Мақсатқа дейін қалған балл (теріс болса — мақсаттан асып тұр) */
  gap: number | null;
  advice: { subjectTitle: string; gain: number } | null;
  weakTopics: WeakTopic[];
  stats: { answered: number; correct: number; mocks: number; bestMock: number | null };
};

const WINDOW_DAYS = 60;
const WEAK_MIN_ANSWERS = 3;

/**
 * Грантқа дейінгі жол: болжамды балл (сынақтар + соңғы 60 күндегі жауаптар), мақсат, әлсіз тақырыптар, кеңес.
 */
export const getGrantOverview = cache(async (locale: string): Promise<GrantOverview | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();

  const [{ data: mocks }, { data: answers }, unt, catalog, specialtyRow] = await Promise.all([
    supabase
      .from("attempts")
      .select("score, max_score, finished_at")
      .eq("user_id", profile.id)
      .eq("kind", "mock")
      .in("status", ["finished", "expired"])
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(10),
    supabase
      .from("attempt_answers")
      .select("question_id, is_correct")
      .eq("user_id", profile.id)
      .not("is_correct", "is", null)
      .gte("updated_at", since)
      .limit(3000),
    getSetting("unt_structure"),
    getCatalog(locale),
    profile.target_specialty_id
      ? supabase.from("specialties").select("code, name_kk, name_ru, threshold_score").eq("id", profile.target_specialty_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Сұрақтың тақырыбы мен пәні (сұрақтар кестесі оқушыға жабық — service_role)
  const ids = [...new Set((answers ?? []).map((a) => a.question_id))];
  const { data: questions } = ids.length
    ? await admin.from("questions").select("id, topic_id, subject_id").in("id", ids)
    : { data: [] };
  const questionById = new Map((questions ?? []).map((q) => [q.id, q]));

  const bySubject = new Map<number, { correct: number; total: number }>();
  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const a of answers ?? []) {
    const q = questionById.get(a.question_id);
    if (!q) continue;
    const s = bySubject.get(q.subject_id) ?? { correct: 0, total: 0 };
    s.total++;
    if (a.is_correct) s.correct++;
    bySubject.set(q.subject_id, s);
    if (q.topic_id) {
      const t = byTopic.get(q.topic_id) ?? { correct: 0, total: 0 };
      t.total++;
      if (a.is_correct) t.correct++;
      byTopic.set(q.topic_id, t);
    }
  }

  const subjectAccuracy: (SubjectAccuracy & { title: string })[] = catalog.flatMap((subject) => {
    const section = unt.sections.find((s) => s.subject === subject.code);
    if (!section) return [];
    const s = bySubject.get(subject.id) ?? { correct: 0, total: 0 };
    return [{ subject: subject.code, title: subject.title, ...s, maxPoints: section.maxPoints }];
  });

  const prediction = predictScore(
    (mocks ?? []).map((m) => ({ score: Number(m.score ?? 0), maxScore: Number(m.max_score ?? 0), finishedAt: m.finished_at! })),
    subjectAccuracy,
    unt.maxScore,
  );

  const weakTopics: WeakTopic[] = catalog
    .flatMap((subject) =>
      subject.topics.map((topic) => {
        const s = byTopic.get(topic.id);
        return s && s.total >= WEAK_MIN_ANSWERS
          ? {
              topicId: topic.id,
              title: topic.title,
              subjectCode: subject.code,
              subjectTitle: subject.title,
              accuracy: Math.round((s.correct / s.total) * 100),
              answered: s.total,
            }
          : null;
      }),
    )
    .filter((t): t is WeakTopic => t !== null && t.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered)
    .slice(0, 3);

  const gain = easiestGain(subjectAccuracy);
  const specialty = specialtyRow.data
    ? { name: localized(specialtyRow.data, "name", locale), code: specialtyRow.data.code, threshold: specialtyRow.data.threshold_score }
    : null;
  const target = profile.target_score ?? specialty?.threshold ?? null;

  return {
    prediction,
    maxScore: unt.maxScore,
    target,
    specialty,
    gap: prediction && target !== null ? target - prediction.score : null,
    advice: gain ? { subjectTitle: subjectAccuracy.find((s) => s.subject === gain.subject)?.title ?? gain.subject, gain: gain.gain } : null,
    weakTopics,
    stats: {
      answered: (answers ?? []).length,
      correct: (answers ?? []).filter((a) => a.is_correct).length,
      mocks: (mocks ?? []).length,
      bestMock: mocks?.length ? Math.max(...mocks.map((m) => Number(m.score ?? 0))) : null,
    },
  };
});
