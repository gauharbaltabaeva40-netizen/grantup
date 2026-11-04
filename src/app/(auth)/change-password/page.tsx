import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ChangePasswordForm } from "@/components/auth/password-forms";
import { getCurrentProfile } from "@/lib/auth/session";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("forcedTitle"), robots: { index: false } };
}

// Әкімші уақытша құпиясөз бергеннен кейін: жаңа құпиясөз қоймайынша платформа ашылмайды
export default async function ChangePasswordPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.must_change_password) redirect("/");

  const t = await getTranslations("auth");
  return (
    <>
      <AuthHeading title={t("forcedTitle")} subtitle={t("forcedText")} />
      <ChangePasswordForm forced />
    </>
  );
}
