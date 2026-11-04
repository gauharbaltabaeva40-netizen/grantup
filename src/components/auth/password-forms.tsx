"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Field, FormMessage, PasswordInput, SubmitButton } from "@/components/forms/fields";
import { Input } from "@/components/ui/input";
import { changePassword, requestPasswordReset, updatePassword } from "@/lib/auth/actions";
import type { FormState } from "@/lib/auth/schemas";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});

  if (state.ok) {
    return (
      <div className="space-y-5">
        <FormMessage tone="success">{t("forgotSent")}</FormMessage>
        <Link href="/login" className="block text-center text-sm font-semibold text-primary hover:underline">
          {t("toLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <FormMessage>{t(`errors.${state.error}`)}</FormMessage>}
      <Field label={t("email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.values?.email} />
      </Field>
      <SubmitButton>{t("forgotSubmit")}</SubmitButton>
      <Link href="/login" className="block pt-1 text-center text-sm font-semibold text-primary hover:underline">
        {t("toLogin")}
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && <FormMessage>{t(`errors.${state.error}`)}</FormMessage>}
      <Field label={t("newPassword")} htmlFor="password" hint={t("passwordHint")}>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <Field label={t("confirmPassword")} htmlFor="confirm">
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <SubmitButton>{t("resetSubmit")}</SubmitButton>
    </form>
  );
}

/** Құпиясөзді өзгерту: профильде (forced=false) және уақытша құпиясөзден кейін (forced=true → басты бетке) */
export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});

  return (
    <form action={action} className="space-y-4" key={state.ok ? "done" : "form"}>
      {state.error && <FormMessage>{t(`errors.${state.error}`)}</FormMessage>}
      {state.ok && <FormMessage tone="success">{t("changed")}</FormMessage>}
      <input type="hidden" name="forced" value={forced ? "1" : "0"} />
      <Field label={forced ? t("tempPassword") : t("currentPassword")} htmlFor="current">
        <PasswordInput id="current" name="current" autoComplete="current-password" maxLength={72} required />
      </Field>
      <Field label={t("newPassword")} htmlFor="new-password" hint={t("passwordHint")}>
        <PasswordInput id="new-password" name="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <Field label={t("confirmPassword")} htmlFor="confirm-password">
        <PasswordInput id="confirm-password" name="confirm" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>
      <SubmitButton>{t("changeSubmit")}</SubmitButton>
    </form>
  );
}
