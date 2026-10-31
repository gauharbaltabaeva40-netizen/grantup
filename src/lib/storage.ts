import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const QUESTION_IMAGES = "question-images";

/** Жабық бакеттегі сұрақ суретіне қысқа мерзімді (10 мин) сілтеме. Жол бос болса — null. */
export async function signedQuestionImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await createAdminClient().storage.from(QUESTION_IMAGES).createSignedUrl(path, 600);
  if (error) {
    console.error("createSignedUrl failed", error);
    return null;
  }
  return data.signedUrl;
}
