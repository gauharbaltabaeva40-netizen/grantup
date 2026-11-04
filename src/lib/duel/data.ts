import "server-only";
import { getSessionUser } from "@/lib/auth/session";
import { asLocale, localized } from "@/lib/content/localize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Duel } from "@/lib/supabase/types";
import { attemptIdFor, buildDuelState, isParticipant, loadDuel, playersById, settleDuel, statusFor } from "./server";
import type { DuelListItem, DuelState } from "./types";

async function subjectTitles(locale: string) {
  const { data } = await createAdminClient().from("subjects").select("id, code, title_kk, title_ru").order("position");
  return (data ?? []).map((s) => ({ id: s.id, code: s.code, title: localized(s, "title", locale) }));
}

/** Дуэль бетінің күйі; қатысушы болмаса — null */
export async function getDuelPage(duelId: string, locale: string): Promise<DuelState | null> {
  const user = await getSessionUser();
  if (!user) return null;
  let duel = await loadDuel(duelId);
  if (!duel || !isParticipant(duel, user.id)) return null;
  duel = await settleDuel(duel);
  const subjects = await subjectTitles(locale);
  return buildDuelState(duel, user.id, subjects.find((s) => s.id === duel.subject_id)?.title ?? null);
}

/** Дуэль орталығы: пәндер (жеткілікті сұрағы барлары), тарих, жеңістер саны */
export async function getDuelHub(locale: string) {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = createAdminClient();

  const [subjects, { data: pool }, { data: rows }] = await Promise.all([
    subjectTitles(locale),
    admin.from("questions").select("subject_id").eq("is_active", true).eq("type", "single").eq("locale", asLocale(locale)).is("group_id", null).limit(5000),
    admin
      .from("duels")
      .select("*")
      .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const counts = new Map<number, number>();
  for (const q of pool ?? []) counts.set(q.subject_id, (counts.get(q.subject_id) ?? 0) + 1);
  const available = subjects.filter((s) => (counts.get(s.id) ?? 0) >= 3);
  const mixedAvailable = (pool ?? []).length >= 3;

  const duels = (rows ?? []) as Duel[];
  const attemptIds = duels.flatMap((d) => [d.creator_attempt_id, d.opponent_attempt_id]).filter((id): id is string => Boolean(id));
  const [{ data: attempts }, players] = await Promise.all([
    attemptIds.length
      ? admin.from("attempts").select("id, status, score").in("id", attemptIds)
      : Promise.resolve({ data: [] as { id: string; status: string; score: number | null }[] }),
    playersById(duels.map((d) => (d.creator_id === user.id ? d.opponent_id : d.creator_id) ?? "")),
  ]);
  const attemptById = new Map((attempts ?? []).map((a) => [a.id, a]));
  const finishedScore = (id: string | null) => {
    const a = id ? attemptById.get(id) : null;
    return a && a.status !== "in_progress" ? Number(a.score ?? 0) : null;
  };

  const items: DuelListItem[] = duels.map((d) => {
    const opponentId = d.creator_id === user.id ? d.opponent_id : d.creator_id;
    const myCorrect = finishedScore(attemptIdFor(d, user.id));
    return {
      id: d.id,
      status: statusFor(d, user.id, myCorrect !== null),
      opponent: opponentId ? (players.get(opponentId) ?? null) : null,
      subjectTitle: subjects.find((s) => s.id === d.subject_id)?.title ?? null,
      myCorrect,
      opponentCorrect: opponentId ? finishedScore(attemptIdFor(d, opponentId)) : null,
      total: d.question_ids.length,
      createdAt: d.created_at,
    };
  });

  return {
    subjects: available.map(({ code, title }) => ({ code, title })),
    mixedAvailable,
    items,
    wins: items.filter((i) => i.status === "won").length,
    losses: items.filter((i) => i.status === "lost").length,
    draws: items.filter((i) => i.status === "draw").length,
  };
}
