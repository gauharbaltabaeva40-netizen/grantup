"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Field, FormMessage } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type AdminErrorKey, extendAccess, grantAccess, revokeAccess } from "@/lib/admin/actions";

export type GrantView = {
  id: string;
  email: string;
  user_id: string | null;
  note: string | null;
  startDate: string;
  endDate: string;
  state: "active" | "scheduled" | "expired" | "revoked";
};

export function GrantAccessForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const t = useTranslations("admin.access");
  const te = useTranslations("admin.errors");
  const [error, setError] = useState<AdminErrorKey | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const result = await grantAccess({
        email: String(formData.get("email") ?? ""),
        startsAt: String(formData.get("startsAt") ?? ""),
        endsAt: String(formData.get("endsAt") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
      if (result.ok) {
        toast.success(t("granted"));
        formRef.current?.reset();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} action={submit} className="grid gap-4 sm:grid-cols-2">
      {error && (
        <div className="sm:col-span-2">
          <FormMessage>{te(error)}</FormMessage>
        </div>
      )}
      <div className="sm:col-span-2">
        <Field label={t("email")} htmlFor="grant-email">
          <Input id="grant-email" name="email" type="email" inputMode="email" autoComplete="off" required />
        </Field>
      </div>
      <Field label={t("startsAt")} htmlFor="grant-start">
        <Input id="grant-start" name="startsAt" type="date" defaultValue={defaultStart} required />
      </Field>
      <Field label={t("endsAt")} htmlFor="grant-end">
        <Input id="grant-end" name="endsAt" type="date" defaultValue={defaultEnd} required />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("note")} htmlFor="grant-note">
          <Input id="grant-note" name="note" maxLength={500} />
        </Field>
      </div>
      <Button type="submit" variant="brand" size="xl" disabled={pending} className="sm:col-span-2 sm:justify-self-start">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("submit")}
      </Button>
    </form>
  );
}

const stateVariant = {
  active: "default",
  scheduled: "secondary",
  expired: "outline",
  revoked: "destructive",
} as const;

export function GrantRow({ grant }: { grant: GrantView }) {
  const t = useTranslations("admin.access");
  const te = useTranslations("admin.errors");
  const [endDate, setEndDate] = useState(grant.endDate);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: AdminErrorKey }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(t("saved"));
      else if (result.error) toast.error(te(result.error));
    });
  }

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{grant.email}</span>
          <Badge variant={stateVariant[grant.state]}>{t(`state.${grant.state}`)}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("period", { from: grant.startDate, to: grant.endDate })} ·{" "}
          {grant.user_id ? t("registered") : t("notRegistered")}
          {grant.note ? ` · ${grant.note}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label={t("endsAt")}
          className="h-10 w-40"
        />
        <Button
          variant="outline"
          size="lg"
          className="h-10"
          disabled={pending || endDate === grant.endDate}
          onClick={() => run(() => extendAccess(grant.id, endDate))}
        >
          {t("extend")}
        </Button>
        {grant.state !== "revoked" && (
          <Button
            variant="destructive"
            size="lg"
            className="h-10"
            disabled={pending}
            onClick={() => run(() => revokeAccess(grant.id))}
          >
            {t("revoke")}
          </Button>
        )}
      </div>
    </li>
  );
}
