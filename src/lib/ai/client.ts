import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// AI-тьютор: Anthropic Claude API. Кілт тек серверде (ANTHROPIC_API_KEY), браузерге ешқашан берілмейді.

let client: Anthropic | null = null;

/** Кілт қойылмаса — null (AI функциялары өшіп, қарапайым нұсқа қолданылады). */
export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

/**
 * Қауіпсіздік классификаторы сұранысты қабылдамаса, сервер оны басқа модельде қайта орындайды
 * (Anthropic ұсынатын модель, бас тарту санатына қарай).
 */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
} as const;
