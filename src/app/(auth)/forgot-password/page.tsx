import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <>
      <AuthHeading title={t("forgotTitle")} subtitle={t("forgotText")} />
      <ForgotPasswordForm />
    </>
  );
}
