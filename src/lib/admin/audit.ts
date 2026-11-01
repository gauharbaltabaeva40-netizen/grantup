import "server-only";
import { revalidatePath } from "next/cache";
import { AuthError } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type { AdminErrorKey, AdminResult } from "./types";

export async function audit(actorId: string, action: string, targetType: string, targetId: string, meta = {}) {
  const { error } = await createAdminClient()
    .from("audit_log")
    .insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, meta });
  if (error) console.error("audit insert failed", error);
}

export function fail(error: unknown): { ok: false; error: "forbidden" | "duplicate" | "in_use" | "unknown" } {
  if (error instanceof AuthError) return { ok: false, error: "forbidden" };
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return { ok: false, error: "duplicate" };
  if (code === "23503") return { ok: false, error: "in_use" };
  console.error("admin action failed", error);
  return { ok: false, error: "unknown" };
}

/** Админ-панельдің барлық беттерін жаңарту */
export function refreshAdmin() {
  revalidatePath("/admin", "layout");
}
