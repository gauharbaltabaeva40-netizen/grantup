import "server-only";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase кілттері жоқ кезде (тек `npm run dev`) админ-панель бос деректермен ашылады — интерфейсті көру үшін.
 * Production-да кілтсіз админ-панель мүлде ашылмайды (404).
 */
export const isAdminDemo = !isSupabaseConfigured && process.env.NODE_ENV === "development";

/**
 * Әр админ беттің басында шақырылады (layout-тағы тексеруге қоса).
 * Рөл тексерілгеннен кейін ғана service_role клиентін қайтарады; демо режимде — null.
 */
export async function adminPage() {
  if (isAdminDemo) return null;
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") notFound();
  return createAdminClient();
}

export type AdminDb = ReturnType<typeof createAdminClient>;

/** Asia/Almaty бойынша YYYY-MM-DD */
export function almatyDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date(date));
}

/** Админ кестелеріне арналған қысқа күн-уақыт (Алматы уақыты) */
export function formatDateTime(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Markdown/KaTeX мәтінінен тізімге арналған қысқа үзінді */
export function plainSnippet(text: string, max = 110) {
  const plain = text
    .replace(/\$\$?([^$]*)\$\$?/g, "$1")
    .replace(/[#*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

export function pageParam(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function stringParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

type GrantRowData = {
  id: string;
  email: string;
  user_id: string | null;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
  note: string | null;
};

/** Доступ жазбасын админ тізіміне арналған көрініске айналдыру */
export function toGrantView(g: GrantRowData, now = Date.now()) {
  return {
    id: g.id,
    email: g.email,
    user_id: g.user_id,
    note: g.note,
    startDate: almatyDate(g.starts_at),
    // ends_at — соңғы күннен кейінгі күннің 00:00-і; адамға соңғы күнді көрсетеміз
    endDate: almatyDate(new Date(new Date(g.ends_at).getTime() - 1)),
    state: g.revoked_at
      ? ("revoked" as const)
      : new Date(g.starts_at).getTime() > now
        ? ("scheduled" as const)
        : new Date(g.ends_at).getTime() <= now
          ? ("expired" as const)
          : ("active" as const),
  };
}

/** Сұрақ/мәтін редакторларына арналған анықтамалар: пәндер, тақырыптар, контекстік мәтіндер */
export async function loadQuestionRefs(db: AdminDb) {
  const [{ data: subjects }, { data: topics }, { data: groups }] = await Promise.all([
    db.from("subjects").select("id, title_kk").order("position"),
    db.from("topics").select("id, subject_id, title_kk").order("position"),
    db.from("question_groups").select("id, subject_id, locale, title, passage").order("created_at", { ascending: false }).limit(1000),
  ]);
  return {
    subjects: (subjects ?? []).map((s) => ({ id: s.id, title: s.title_kk })),
    topics: (topics ?? []).map((t) => ({ id: t.id, subject_id: t.subject_id, title: t.title_kk })),
    groups: (groups ?? []).map((g) => ({ id: g.id, subject_id: g.subject_id, locale: g.locale, title: g.title || plainSnippet(g.passage, 60) })),
  };
}
