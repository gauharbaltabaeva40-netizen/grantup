"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { ChoiceGroup, Field, FormMessage, PasswordInput, SubmitButton } from "@/components/forms/fields";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/auth/actions";
import type { FormState } from "@/lib/auth/schemas";

export function SignupForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState<FormState, FormData>(signUp, {});
  const v = state.values;

  return (
    <form action={action} className="space-y-5">
      {state.error && <FormMessage>{t(`errors.${state.error}`)}</FormMessage>}

      <Field label={t("fullName")} htmlFor="fullName">
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder={t("fullNamePlaceholder")}
          minLength={2}
          maxLength={100}
          required
          defaultValue={v?.fullName}
        />
      </Field>
      <Field label={t("email")} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={v?.email} />
      </Field>
      <Field label={t("password")} htmlFor="password" hint={t("passwordHint")}>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} maxLength={72} required />
      </Field>

      <ChoiceGroup
        name="grade"
        legend={t("grade")}
        defaultValue={v?.grade}
        options={[
          { value: "10", label: t("grade10") },
          { value: "11", label: t("grade11") },
          { value: "graduate", label: t("gradeGraduate") },
        ]}
      />
      <ChoiceGroup
        name="locale"
        legend={t("language")}
        columns={2}
        defaultValue={v?.locale || locale}
        options={[
          { value: "kk", label: "Қазақша" },
          { value: "ru", label: "Русский" },
        ]}
      />

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("profilePair")}</p>
        <input type="hidden" name="profilePair" value="math_informatics" />
        <div className="flex h-12 items-center justify-between rounded-xl border border-primary bg-secondary px-4 text-sm font-semibold text-primary">
          {t("pairMathInf")}
          <Lock className="size-4 opacity-70" aria-hidden />
        </div>
        <p className="text-xs text-muted-foreground">{t("pairOnly")}</p>
      </div>

      <SubmitButton>{t("submitSignup")}</SubmitButton>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        {t.rich("agree", {
          terms: (chunks) => (
            <Link href={locale === "ru" ? "/ru/terms" : "/terms"} target="_blank" className="font-semibold text-primary hover:underline">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href={locale === "ru" ? "/ru/privacy" : "/privacy"} target="_blank" className="font-semibold text-primary hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>

      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          {t("toLogin")}
        </Link>
      </p>
    </form>
  );
}
