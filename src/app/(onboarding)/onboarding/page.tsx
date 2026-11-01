import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { Protected } from "@/components/protection/protection";
import { getCurrentProfile } from "@/lib/auth/session";
import { localized } from "@/lib/content/localize";
import { getSetting } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const t = await getTranslations("onboarding.slides");
  return { title: t("s1t") };
}

export default async function OnboardingPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.onboarding_completed_at) redirect("/");

  const [locale, diagnostic, supabase] = await Promise.all([getLocale(), getSetting("diagnostic"), createClient()]);
  const { data: specialties } = await supabase
    .from("specialties")
    .select("id, code, name_kk, name_ru, threshold_score")
    .eq("is_active", true)
    .order("threshold_score", { ascending: false });

  return (
    <Protected>
    <OnboardingFlow
      initialTarget={profile.target_score}
      diagnosticMinutes={diagnostic.durationMinutes}
      diagnosticCount={Object.values(diagnostic.perSubject).reduce((a, b) => a + b, 0)}
      specialties={(specialties ?? []).map((s) => ({
        id: s.id,
        code: s.code,
        name: localized(s, "name", locale),
        threshold: s.threshold_score,
      }))}
    />
    </Protected>
  );
}
