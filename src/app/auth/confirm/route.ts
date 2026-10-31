import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/config/routes";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Email растау және құпиясөзді қалпына келтіру сілтемелері осында келеді.
 * - `token_hash` + `type` — ұсынылатын әдіс (сілтеме кез келген құрылғыда ашылады;
 *   Supabase email шаблондарын README-дегідей өзгерту керек)
 * - `code` — әдепкі PKCE сілтемесі (тек тіркелген браузерде жұмыс істейді)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/device");

  let ok = false;
  const supabase = isSupabaseConfigured ? await createClient() : null;

  if (!supabase) {
    // Демо режим — растайтын ештеңе жоқ
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const url = request.nextUrl.clone();
  url.search = "";
  if (ok) {
    const [pathname, query] = next.split("?");
    url.pathname = pathname;
    if (query) url.search = `?${query}`;
  } else {
    url.pathname = "/login";
    url.searchParams.set("error", "link_invalid");
  }
  return NextResponse.redirect(url);
}
