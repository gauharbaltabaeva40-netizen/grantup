import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { SignupForm } from "@/components/auth/signup-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signupTitle"), description: t("signupSubtitle"), alternates: { canonical: "/signup" } };
}

export default async function SignupPage() {
  const t = await getTranslations("auth");

  return (
    <>
      <AuthHeading title={t("signupTitle")} subtitle={t("signupSubtitle")} />
      <SignupForm />
    </>
  );
}
