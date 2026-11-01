"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AVATARS } from "./avatars";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  nickname: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v || null)
    .refine((v) => v === null || v.length >= 2),
  avatar: z.enum(AVATARS).nullable(),
  grade: z.enum(["10", "11", "graduate"]).nullable(),
});

/** Профильді өзгерту (тек рұқсат етілген бағандар — RLS және бағандар құқығы). */
export async function updateProfile(input: z.input<typeof profileSchema>): Promise<{ ok: boolean }> {
  try {
    const user = await requireUser();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    const { fullName, nickname, avatar, grade } = parsed.data;
    const { error } = await (await createClient())
      .from("profiles")
      .update({ full_name: fullName, nickname, avatar, grade })
      .eq("id", user.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("updateProfile failed", error);
    return { ok: false };
  }
}

const notificationsSchema = z.object({
  push_streak: z.boolean(),
  push_league: z.boolean(),
  push_weekly: z.boolean(),
  email_weekly: z.boolean(),
  email_access_expiry: z.boolean(),
});

export async function updateNotifications(input: z.infer<typeof notificationsSchema>): Promise<{ ok: boolean }> {
  try {
    const user = await requireUser();
    const parsed = notificationsSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    const { error } = await (await createClient()).from("notifications_settings").update(parsed.data).eq("user_id", user.id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("updateNotifications failed", error);
    return { ok: false };
  }
}
