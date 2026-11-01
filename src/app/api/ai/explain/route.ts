import Anthropic from "@anthropic-ai/sdk";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getAccess } from "@/lib/access";
import { FALLBACK, getAnthropic } from "@/lib/ai/client";
import { explainSystemPrompt } from "@/lib/ai/prompts";
import { AuthError, requireUser } from "@/lib/auth/session";
import { asLocale } from "@/lib/content/localize";
import { almatyToday } from "@/lib/gamification/xp";
import { rateLimit } from "@/lib/rate-limit";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * «Неге қате?» — AI түсіндірмесі (стрим).
 * - Тек оқушының өз әрекетіндегі қате (немесе жауапсыз) сұраққа; сынақ ҰБТ жүріп жатқанда — жоқ.
 * - Бірдей сұрақ + бірдей жауап + тіл үшін кэш (лимитке кірмейді).
 * - Күндік лимит: толық доступ / тегін нұсқа үшін бөлек (app_settings.ai_limits).
 */

const bodySchema = z.object({ attemptId: z.uuid(), questionId: z.uuid() });
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (error) {
    return json(error instanceof AuthError && error.code === "not_configured" ? 503 : 401, { error: "unauthenticated" });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_input" });
  if (!(await rateLimit(`ai:explain:${user.id}`, 20, 60))) return json(429, { error: "rate_limited" });

  const { attemptId, questionId } = parsed.data;
  const admin = createAdminClient();

  const { data: attempt } = await admin
    .from("attempts")
    .select("id, kind, status, question_ids")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!attempt || !attempt.question_ids.includes(questionId)) return json(404, { error: "not_found" });
  if (attempt.kind === "mock" && attempt.status === "in_progress") return json(403, { error: "not_allowed" });

  const { data: answer } = await admin
    .from("attempt_answers")
    .select("selected_option_ids, is_correct")
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (!answer || answer.is_correct !== false) return json(403, { error: "not_allowed" });

  const locale = asLocale(await getLocale());
  const answerKey = [...answer.selected_option_ids].sort().join(",") || "none";

  // 1. Кэш
  const { data: cached } = await admin
    .from("ai_explanations")
    .select("content")
    .eq("question_id", questionId)
    .eq("answer_key", answerKey)
    .eq("locale", locale)
    .maybeSingle();
  if (cached) return new Response(cached.content, { headers: { "content-type": "text/plain; charset=utf-8", "x-cache": "hit" } });

  const anthropic = getAnthropic();
  if (!anthropic) return json(503, { error: "ai_unavailable" });

  // 2. Күндік лимит (атомарлы)
  const [limits, access] = await Promise.all([getSetting("ai_limits"), getAccess()]);
  const max = access.tier === "full" ? limits.paidDailyExplanations : limits.freeDailyExplanations;
  const day = almatyToday();
  const { data: allowed } = await admin.rpc("ai_usage_hit", { p_user: user.id, p_day: day, p_kind: "explain", p_max: max });
  if (!allowed) return json(429, { error: "limit", max });

  // 3. Сұрақтың толық мазмұны (тек серверде)
  const [{ data: question }, { data: options }] = await Promise.all([
    admin.from("questions").select("stem, explanation, type, group_id").eq("id", questionId).single(),
    admin.from("question_options").select("id, position, content, is_correct").eq("question_id", questionId).order("position"),
  ]);
  if (!question || !options) {
    await admin.rpc("ai_usage_refund", { p_user: user.id, p_day: day, p_kind: "explain" });
    return json(404, { error: "not_found" });
  }
  const { data: group } = question.group_id
    ? await admin.from("question_groups").select("passage").eq("id", question.group_id).single()
    : { data: null };

  const letter = (id: string) => LETTERS[options.findIndex((o) => o.id === id)] ?? "?";
  const selected = answer.selected_option_ids.map(letter).join(", ") || (locale === "ru" ? "ответа нет" : "жауап берілмеген");
  const correct = options.filter((o) => o.is_correct).map((o) => letter(o.id)).join(", ");

  const userContent = [
    group?.passage ? `<passage>\n${group.passage}\n</passage>` : "",
    `<question type="${question.type}">\n${question.stem}\n</question>`,
    `<options>\n${options.map((o, i) => `${LETTERS[i]}) ${o.content}`).join("\n")}\n</options>`,
    `<student_answer>${selected}</student_answer>`,
    `<correct_answer>${correct}</correct_answer>`,
    question.explanation ? `<reference_explanation>\n${question.explanation}\n</reference_explanation>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = anthropic.beta.messages.stream({
    model: limits.model,
    max_tokens: 8000,
    ...FALLBACK,
    betas: [...FALLBACK.betas],
    output_config: { effort: "low" },
    system: explainSystemPrompt(locale),
    messages: [{ role: "user", content: userContent }],
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "end_turn" && text.trim()) {
          await admin
            .from("ai_explanations")
            .upsert({ question_id: questionId, answer_key: answerKey, locale, content: text, model: final.model }, {
              onConflict: "question_id,answer_key,locale",
            });
        } else if (final.stop_reason === "refusal" && !text.trim()) {
          await admin.rpc("ai_usage_refund", { p_user: user.id, p_day: day, p_kind: "explain" });
        }
      } catch (error) {
        console.error("AI explain failed", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
        await admin.rpc("ai_usage_refund", { p_user: user.id, p_day: day, p_kind: "explain" });
        controller.enqueue(encoder.encode(text ? "\n\n…" : "\u0000ERROR"));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
