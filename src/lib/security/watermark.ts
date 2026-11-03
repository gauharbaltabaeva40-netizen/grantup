import "server-only";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Су таңбасының мәтіні: бренд (GrantUp.kz логотипімен бірге көрсетіледі). Жеке дерек (email) көрсетілмейді.
 * Кірмеген пайдаланушыға (демо) — бос, су таңбасы шықпайды.
 */
export async function getWatermarkText(): Promise<string> {
  const user = await getSessionUser();
  return user ? "GrantUp.kz" : "";
}
