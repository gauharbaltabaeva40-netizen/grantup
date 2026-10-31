import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";
import type { Database } from "./types";

/**
 * RLS-ті айналып өтетін клиент (service_role / secret кілт). ТЕК серверде, тек тексерілген әрекеттер үшін:
 * құрылғыларды тіркеу, доступ беру, қауіпсіздік журналы, rate limiting.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is not set");

  return createClient<Database>(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
