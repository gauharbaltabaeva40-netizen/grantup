"use server";

import { revalidatePath } from "next/cache";
import { AuthError, requireUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { generateStudyPlan } from "./server";

/** «Жоспарды жаңарту» батырмасы. Апталық лимит асса — false. */
export async function regeneratePlan(): Promise<{ ok: boolean; error?: "limit" | "rate_limited" | "unknown" }> {
  try {
    const user = await requireUser();
    if (!(await rateLimit(`plan:regen:${user.id}`, 3, 60 * 60))) return { ok: false, error: "rate_limited" };
    const plan = await generateStudyPlan(user.id, "manual");
    revalidatePath("/", "layout");
    return plan ? { ok: true } : { ok: false, error: "limit" };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("regeneratePlan failed", error);
    return { ok: false, error: "unknown" };
  }
}
