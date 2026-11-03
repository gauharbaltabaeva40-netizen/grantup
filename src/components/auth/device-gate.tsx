"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Ban, Loader2, RefreshCw, ShieldCheck, ShieldX, Smartphone } from "lucide-react";
import { FormMessage } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signOut } from "@/lib/auth/actions";
import { confirmDeviceCode, registerDevice, type CodeResult, type DeviceStatus } from "@/lib/device/actions";
import { getDeviceIdentity, storeDeviceKey, type DeviceIdentity } from "@/lib/device/fingerprint";

type View = DeviceStatus | { status: "checking" };

export function DeviceGate({ next }: { next: string }) {
  const t = useTranslations("device");
  const [view, setView] = useState<View>({ status: "checking" });
  const [codeError, setCodeError] = useState<Extract<CodeResult, { ok: false }> | null>(null);
  const [pending, startTransition] = useTransition();
  const identity = useRef<DeviceIdentity | null>(null);

  /**
   * Құрылғы расталған соң — толық (hard) навигация. Клиенттік router.replace жарамайды:
   * бет ашылғанда Next.js басқа беттерді алдын ала жүктеп (prefetch) қояды, ол кезде cookie әлі жоқ,
   * middleware оларды /device-ке қайтарған — сол кэштегі редирект қолданылып, бет ауыспай қалады.
   */
  const leave = useCallback(() => window.location.replace(next), [next]);

  const check = useCallback(async () => {
    try {
      identity.current ??= await getDeviceIdentity();
      const result = await registerDevice(identity.current);
      if (result.status === "ok") {
        storeDeviceKey(result.deviceKey);
        leave();
        return;
      }
      setView(result);
    } catch (error) {
      // Желі үзілсе немесе сервер жауап бермесе — шексіз айналмай, қайталау батырмасын көрсетеміз
      console.error("device check failed", error);
      setView({ status: "error", error: "unknown" });
    }
  }, [leave]);

  useEffect(() => {
    void check();
  }, [check]);

  function submitCode(formData: FormData) {
    const code = String(formData.get("code") ?? "").replace(/\D/g, "");
    startTransition(async () => {
      if (!identity.current) return;
      const result = await confirmDeviceCode(identity.current, code);
      if (result.ok) {
        leave();
        return;
      }
      setCodeError(result);
      if (result.error === "blocked") setView({ status: "blocked" });
    });
  }

  const signOutButton = (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="xl" className="w-full text-muted-foreground">
        {t("otherAccount")}
      </Button>
    </form>
  );

  if (view.status === "checking" || view.status === "ok") {
    return (
      <div className="flex flex-col items-center py-8 text-center" aria-busy>
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="mt-4 font-semibold">{t("checking")}</p>
      </div>
    );
  }

  if (view.status === "error") {
    return (
      <div className="space-y-4">
        <FormMessage>{t(`errors.${view.error}`)}</FormMessage>
        <Button variant="brand" size="2xl" className="w-full" onClick={() => startTransition(check)} disabled={pending}>
          <RefreshCw aria-hidden />
          {t("refresh")}
        </Button>
        {signOutButton}
      </div>
    );
  }

  if (view.status === "rejected" || view.status === "blocked") {
    const rejected = view.status === "rejected";
    const Icon = rejected ? ShieldX : Ban;
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-danger/10 text-danger">
          <Icon className="size-8" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t(rejected ? "rejectedTitle" : "blockedTitle")}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {t(rejected ? "rejectedText" : "blockedText")}
          </p>
        </div>
        {signOutButton}
      </div>
    );
  }

  // pending | approved — код енгізу
  return (
    <div className="space-y-5">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-secondary text-primary">
        <Smartphone className="size-8" aria-hidden />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("limitText")}</p>
      </div>

      <p className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed">
        {t(view.status === "approved" ? "approvedText" : "pendingText")}
      </p>

      <form action={submitCode} className="space-y-3">
        {codeError && (
          <FormMessage>{t(`errors.${codeError.error}`, { count: codeError.attemptsLeft ?? 0 })}</FormMessage>
        )}
        <label htmlFor="code" className="text-sm font-semibold">
          {t("codeLabel")}
        </label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="••••••"
          className="h-14 text-center text-2xl font-bold tracking-[0.5em] tabular-nums"
        />
        <Button type="submit" variant="brand" size="2xl" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
          {t("codeSubmit")}
        </Button>
      </form>

      <Button variant="outline" size="xl" className="w-full" onClick={() => startTransition(check)} disabled={pending}>
        <RefreshCw aria-hidden />
        {t("refresh")}
      </Button>

      <details className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">{t("whyTitle")}</summary>
        <p className="mt-2 leading-relaxed text-muted-foreground">{t("whyText")}</p>
      </details>

      {signOutButton}
    </div>
  );
}
