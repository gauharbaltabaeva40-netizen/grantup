// Content-Security-Policy (nonce-пен). Middleware әр сұранысқа жаңа nonce жасайды;
// Next.js өз скрипттеріне оны автоматты қосады, next-themes скриптіне — root layout арқылы.

import { supabaseUrl } from "@/lib/env";

export function createNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function buildCsp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const supabaseWs = supabase.replace(/^https:/, "wss:");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // strict-dynamic: сенімді скрипт жүктеген скрипттерге (YouTube IFrame API) рұқсат
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "https://www.youtube.com", ...(dev ? ["'unsafe-eval'"] : [])],
    // KaTeX пен React inline стильдері
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://i.ytimg.com", ...(supabase ? [supabase] : [])],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(supabase ? [supabase, supabaseWs] : []), ...(dev ? ["ws:", "wss:"] : [])],
    "frame-src": ["https://www.youtube-nocookie.com", "https://www.youtube.com"],
    "media-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  return [
    ...Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`),
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
