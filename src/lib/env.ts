// Орта айнымалылары. Supabase-тің жаңа (publishable/secret) және ескі (anon/service_role) кілт атауларының екеуі де қолдау табады.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Supabase кілттері қойылмаса, қосымша «демо режимде» жұмыс істейді:
 * auth тексерілмейді, беттер макет деректерімен көрсетіледі. Production-да кілттер міндетті.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

export const DEV_SECRET = "dev-only-insecure-secret-change-me-0000000000";

/** Cookie қолтаңбасы мен растау кодтарын хэштеуге арналған құпия (≥ 32 таңба). */
export function getAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && isSupabaseConfigured) {
    throw new Error("APP_SECRET is missing or shorter than 32 characters");
  }
  return DEV_SECRET;
}
