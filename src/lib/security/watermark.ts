import "server-only";
import { getSessionUser } from "@/lib/auth/session";

/** Су таңбасының мәтіні: email + қысқа ID (скриншот таралса, кімдікі екенін анықтау үшін). */
export async function getWatermarkText(): Promise<string> {
  const user = await getSessionUser();
  return user ? `${user.email} · ${user.id.slice(0, 8)}` : "";
}
