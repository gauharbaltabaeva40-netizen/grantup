import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/config/routes";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("submitLogin"), description: t("loginSubtitle"), alternates: { canonical: "/login" } };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <>
      <AuthHeading title={t("loginTitle")} subtitle={t("loginSubtitle")} />
      <LoginForm next={safeNext(next)} linkError={error === "link_invalid"} />
    </>
  );
}
