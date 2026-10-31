"use server";

import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "./config";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Кірген пайдаланушының профиліне де сақтаймыз (басқа құрылғыда да сол тіл ашылады)
  const user = await getSessionUser();
  if (user) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ locale }).eq("id", user.id);
  }
}
