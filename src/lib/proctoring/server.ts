import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROCTORING_RETENTION_DAYS } from "./constants";

const BUCKET = "proctoring";

/** Ескі прокторинг деректерін өшіру (фотолар + оқиғалар). Күнделікті cron шақырады. */
export async function purgeOldProctoring(): Promise<number> {
  const admin = createAdminClient();
  const before = new Date(Date.now() - PROCTORING_RETENTION_DAYS * 24 * 3600_000).toISOString();
  let removed = 0;

  for (;;) {
    const { data } = await admin
      .from("proctoring_events")
      .select("id, image_path")
      .lt("created_at", before)
      .order("id")
      .limit(500);
    if (!data?.length) break;

    const paths = data.map((e) => e.image_path).filter((p): p is string => Boolean(p));
    if (paths.length) {
      const { error } = await admin.storage.from(BUCKET).remove(paths);
      if (error) throw error;
    }
    const { error } = await admin.from("proctoring_events").delete().in("id", data.map((e) => e.id));
    if (error) throw error;
    removed += data.length;
    if (data.length < 500) break;
  }
  return removed;
}

/** Админге фото көрсету үшін қысқа мерзімді (10 мин) сілтемелер */
export async function signedProctoringImages(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!paths.length) return result;
  const { data } = await createAdminClient().storage.from(BUCKET).createSignedUrls(paths, 600);
  for (const item of data ?? []) if (item.path && item.signedUrl) result.set(item.path, item.signedUrl);
  return result;
}
