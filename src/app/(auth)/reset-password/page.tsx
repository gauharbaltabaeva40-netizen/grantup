import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/components/auth/auth-heading";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { FormMessage } from "@/components/forms/fields";
import { getSessionUser } from "@/lib/auth/session";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("resetTitle") };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  // Қалпына келтіру сілтемесі /auth/confirm арқылы уақытша сессия ашады
  const user = await getSessionUser();

  return (
    <>
      <AuthHeading title={t("resetTitle")} subtitle={user ? t("resetText") : undefined} />
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-4">
          <FormMessage>{t("errors.session_expired")}</FormMessage>
          <Link href="/forgot-password" className="block text-center text-sm font-semibold text-primary hover:underline">
            {t("forgotTitle")}
          </Link>
        </div>
      )}
    </>
  );
}
