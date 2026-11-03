"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Field, FormMessage, PasswordInput, SubmitButton } from "@/components/forms/fields";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/actions";
import type { FormState } from "@/lib/auth/schemas";

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4" noValidate={false}>
      {state.error && <FormMessage>{t(`errors.${state.error}`)}</FormMessage>}
      {!state.error && linkError && <FormMessage>{t("errors.link_invalid")}</FormMessage>}

      <input type="hidden" name="next" value={next ?? "/"} />
      <Field label={t("email")} htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
        />
      </Field>
      <Field label={t("password")} htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton>{t("submitLogin")}</SubmitButton>

      <p className="pt-2 text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          {t("toSignup")}
        </Link>
      </p>
    </form>
  );
}
