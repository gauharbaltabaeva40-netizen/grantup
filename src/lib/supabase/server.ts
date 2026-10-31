import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublicKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./types";

/** Server Component / Server Action / Route Handler ішінде — пайдаланушы сессиясымен (RLS қолданылады). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component ішінен cookie жазуға болмайды — сессияны middleware жаңартады.
        }
      },
    },
  });
}
