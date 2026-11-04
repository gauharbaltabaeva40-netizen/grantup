import "server-only";
import { randomInt } from "node:crypto";
import { almatyToday, awardXp } from "@/lib/gamification/xp";
import { shuffle } from "@/lib/quiz/grading";
import { buildOptionOrder, cryptoRandom, finalizeAttempt } from "@/lib/quiz/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppLocale, Attempt, Duel } from "@/lib/supabase/types";
import {
  DUEL_SECONDS_PER_QUESTION,
  DUEL_SIZE,
  DUEL_WIN_XP,
  DUEL_WIN_XP_PER_DAY,
  type DuelPlayer,
  type DuelSide,
  type DuelState,
  type DuelStatus,
} from "./types";

// Дуэльдің серверлік логикасы. Әр функция қатысушыны тексереді; жазу — service_role.

/** Шатастырмайтын таңбалар (0/O, 1/I жоқ) */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Желі кідірісі үшін қосымша уақыт */
const GRACE_SECONDS = 20;
const MIN_QUESTIONS = 3;

export function makeDuelCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");
}

/** Дуэльге жарайтын сұрақтар: белсенді, бір жауапты, контекстік мәтінсіз (30 секундқа сыятындай). */
export async function pickDuelQuestions(locale: AppLocale, subjectId: number | null) {
  let query = createAdminClient()
    .from("questions")
    .select("id")
    .eq("is_active", true)
    .eq("type", "single")
    .eq("locale", locale)
    .is("group_id", null)
    .limit(1000);
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data } = await query;
  const ids = shuffle((data ?? []).map((q) => q.id), cryptoRandom).slice(0, DUEL_SIZE);
  return ids.length >= MIN_QUESTIONS ? ids : null;
}

/** Ойыншының осы дуэльдегі әрекеті (бірдей сұрақтар мен нұсқа реті) */
export async function createDuelAttempt(duel: Duel, userId: string) {
  const now = Date.now();
  const deadline = new Date(now + (duel.question_ids.length * DUEL_SECONDS_PER_QUESTION + GRACE_SECONDS) * 1000);
  const { data, error } = await createAdminClient()
    .from("attempts")
    .insert({
      user_id: userId,
      kind: "duel",
      locale: duel.locale,
      subject_id: duel.subject_id,
      question_ids: duel.question_ids,
      option_order: duel.option_order,
      max_score: duel.question_ids.length,
      started_at: new Date(now).toISOString(),
      deadline_at: deadline.toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) throw error;

  await createAdminClient()
    .from("duels")
    .update(duel.creator_id === userId ? { creator_attempt_id: data.id } : { opponent_attempt_id: data.id })
    .eq("id", duel.id);
  return data as Attempt;
}

export async function newDuel(input: { userId: string; locale: AppLocale; subjectId: number | null; isOpen: boolean }) {
  const questionIds = await pickDuelQuestions(input.locale, input.subjectId);
  if (!questionIds) return null;
  const optionOrder = await buildOptionOrder(questionIds);

  // Код бірегей болмаса (өте сирек) — қайталаймыз
  for (let i = 0; i < 5; i++) {
    const { data, error } = await createAdminClient()
      .from("duels")
      .insert({
        code: makeDuelCode(),
        subject_id: input.subjectId,
        locale: input.locale,
        question_ids: questionIds,
        option_order: optionOrder,
        creator_id: input.userId,
        is_open: input.isOpen,
      })
      .select("*")
      .single();
    if (data) return data as Duel;
    if (error?.code !== "23505") throw error;
  }
  throw new Error("duel code collision");
}

/** Кездейсоқ қарсылас: біреу ашып қойған дуэльге қосылу (бірінші қосылған алады). */
export async function joinOpenDuel(userId: string, locale: AppLocale, subjectId: number | null) {
  const admin = createAdminClient();
  let query = admin
    .from("duels")
    .select("id")
    .eq("is_open", true)
    .is("opponent_id", null)
    .is("finished_at", null)
    .neq("creator_id", userId)
    .eq("locale", locale)
    .gt("expires_at", new Date().toISOString())
    .order("created_at")
    .limit(5);
  query = subjectId ? query.eq("subject_id", subjectId) : query.is("subject_id", null);
  const { data: candidates } = await query;

  for (const candidate of candidates ?? []) {
    const { data: taken } = await admin
      .from("duels")
      .update({ opponent_id: userId })
      .eq("id", candidate.id)
      .is("opponent_id", null)
      .select("*")
      .maybeSingle();
    if (taken) return taken as Duel;
  }
  return null;
}

export async function loadDuel(duelId: string) {
  const { data } = await createAdminClient().from("duels").select("*").eq("id", duelId).maybeSingle();
  return (data as Duel | null) ?? null;
}

export function isParticipant(duel: Duel, userId: string) {
  return duel.creator_id === userId || duel.opponent_id === userId;
}

export function attemptIdFor(duel: Duel, userId: string) {
  return duel.creator_id === userId ? duel.creator_attempt_id : duel.opponent_attempt_id;
}

export async function loadAttempt(attemptId: string | null) {
  if (!attemptId) return null;
  const { data } = await createAdminClient().from("attempts").select("*").eq("id", attemptId).maybeSingle();
  return (data as Attempt | null) ?? null;
}

export function isPastDuelDeadline(attempt: Attempt) {
  return Boolean(attempt.deadline_at) && Date.now() > new Date(attempt.deadline_at!).getTime();
}

/** Мерзімі өткен әрекетті аяқтау (бетті жауып кеткен ойыншы) */
export async function closeIfOverdue(attempt: Attempt | null) {
  if (attempt && attempt.status === "in_progress" && isPastDuelDeadline(attempt)) {
    await finalizeAttempt(attempt);
    await createAdminClient().from("attempts").update({ status: "expired" }).eq("id", attempt.id).eq("status", "finished");
    return { ...attempt, status: "expired" as const, finished_at: attempt.deadline_at };
  }
  return attempt;
}

type Score = { correct: number; seconds: number; marks: (boolean | null)[] };

async function scoreOf(attempt: Attempt | null): Promise<Score | null> {
  if (!attempt || attempt.status === "in_progress") return null;
  const { data: answers } = await createAdminClient()
    .from("attempt_answers")
    .select("question_id, is_correct")
    .eq("attempt_id", attempt.id);
  const byQuestion = new Map((answers ?? []).map((a) => [a.question_id, a.is_correct]));
  const marks = attempt.question_ids.map((id) => (byQuestion.has(id) ? Boolean(byQuestion.get(id)) : null));
  const end = new Date(attempt.finished_at ?? attempt.deadline_at ?? attempt.started_at).getTime();
  const seconds = Math.max(0, Math.round((end - new Date(attempt.started_at).getTime()) / 1000));
  return { correct: marks.filter(Boolean).length, seconds, marks };
}

/**
 * Екеуі де ойнап болса — жеңімпазды бір рет белгілеп, XP береміз.
 * Көп дұрыс жауап жеңеді; тең болса — аз уақыт; уақыт та тең болса — тең ойын.
 */
export async function settleDuel(duel: Duel) {
  if (duel.finished_at || !duel.opponent_id) return duel;
  const [mine, theirs] = await Promise.all([
    loadAttempt(duel.creator_attempt_id).then(closeIfOverdue).then(scoreOf),
    loadAttempt(duel.opponent_attempt_id).then(closeIfOverdue).then(scoreOf),
  ]);
  if (!mine || !theirs) return duel;

  let winner: string | null = null;
  if (mine.correct !== theirs.correct) winner = mine.correct > theirs.correct ? duel.creator_id : duel.opponent_id;
  else if (mine.seconds !== theirs.seconds) winner = mine.seconds < theirs.seconds ? duel.creator_id : duel.opponent_id;

  const { data: settled } = await createAdminClient()
    .from("duels")
    .update({ winner_id: winner, is_draw: winner === null, finished_at: new Date().toISOString() })
    .eq("id", duel.id)
    .is("finished_at", null)
    .select("*")
    .maybeSingle();

  // Тек осы сұраныс белгілесе ғана XP береміз (екі ойыншы бір мезетте аяқтаса да бір рет)
  if (settled && winner && (mine.correct > 0 || theirs.correct > 0)) {
    if (await rateLimit(`duel:winxp:${winner}:${almatyToday()}`, DUEL_WIN_XP_PER_DAY, 86400)) {
      await awardXp(winner, DUEL_WIN_XP, "duel_win", duel.id);
    }
  }
  return (settled as Duel | null) ?? (await loadDuel(duel.id)) ?? duel;
}

/** Лига сияқты: лақап ат немесе есімнің бірінші сөзі (email ешқашан көрсетілмейді) */
export async function playersById(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, DuelPlayer>();
  const { data } = await createAdminClient().from("profiles").select("id, nickname, full_name, avatar").in("id", unique);
  return new Map(
    (data ?? []).map((p) => [
      p.id,
      { name: p.nickname?.trim() || p.full_name?.trim().split(/\s+/)[0] || "GrantUp", avatar: p.avatar } satisfies DuelPlayer,
    ]),
  );
}

export function statusFor(duel: Duel, userId: string, mineFinished: boolean): DuelStatus {
  if (duel.finished_at) {
    if (duel.is_draw) return "draw";
    return duel.winner_id === userId ? "won" : "lost";
  }
  if (!mineFinished) return new Date(duel.expires_at).getTime() < Date.now() ? "expired" : "play";
  return new Date(duel.expires_at).getTime() < Date.now() ? "expired" : "waiting";
}

/** Дуэль экранының толық күйі (ойын + нәтиже) */
export async function buildDuelState(duel: Duel, userId: string, subjectTitle: string | null): Promise<DuelState> {
  const isCreator = duel.creator_id === userId;
  const opponentId = isCreator ? duel.opponent_id : duel.creator_id;
  const [myAttempt, theirAttempt, players] = await Promise.all([
    loadAttempt(attemptIdFor(duel, userId)).then(closeIfOverdue),
    opponentId ? loadAttempt(attemptIdFor(duel, opponentId)).then(closeIfOverdue) : Promise.resolve(null),
    playersById([userId, opponentId ?? ""]),
  ]);
  const [myScore, theirScore] = await Promise.all([scoreOf(myAttempt), scoreOf(theirAttempt)]);

  const side = (id: string | null, score: Score | null): DuelSide | null =>
    id
      ? {
          ...(players.get(id) ?? { name: "GrantUp", avatar: null }),
          correct: score?.correct ?? null,
          seconds: score?.seconds ?? null,
          finished: Boolean(score),
          marks: score?.marks ?? duel.question_ids.map(() => null),
        }
      : null;

  // Келесі сұрақ: жауап берілген сұрақтардан кейінгісі
  let nextIndex = 0;
  if (myAttempt && myAttempt.status === "in_progress") {
    const { data: answers } = await createAdminClient().from("attempt_answers").select("question_id").eq("attempt_id", myAttempt.id);
    const answered = new Set((answers ?? []).map((a) => a.question_id));
    nextIndex = duel.question_ids.findIndex((id) => !answered.has(id));
    if (nextIndex === -1) nextIndex = duel.question_ids.length;
  }

  // Жеңіс XP-і (көрсету үшін)
  let xpWon = 0;
  if (duel.finished_at && duel.winner_id === userId) {
    const { data: event } = await createAdminClient()
      .from("xp_events")
      .select("amount")
      .eq("user_id", userId)
      .eq("reason", "duel_win")
      .eq("ref_id", duel.id)
      .maybeSingle();
    xpWon = event?.amount ?? 0;
  }

  return {
    id: duel.id,
    code: duel.code,
    subjectTitle,
    total: duel.question_ids.length,
    secondsPerQuestion: DUEL_SECONDS_PER_QUESTION,
    status: statusFor(duel, userId, Boolean(myScore)),
    isCreator,
    isOpen: duel.is_open,
    me: side(userId, myScore)!,
    opponent: side(opponentId, theirScore),
    attemptId: myAttempt?.status === "in_progress" ? myAttempt.id : null,
    nextIndex,
    deadlineAt: myAttempt?.status === "in_progress" ? myAttempt.deadline_at : null,
    serverNow: new Date().toISOString(),
    expiresAt: duel.expires_at,
    xpWon,
  };
}
