"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deletePushSubscription, savePushSubscription } from "@/lib/notify/push-actions";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Осы құрылғыда push хабарламаларын қосу/өшіру. iPhone-да — тек басты экранға қосылған PWA-да (iOS 16.4+). */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const t = useTranslations("push");
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState("unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  const enable = () =>
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const result = await savePushSubscription(subscription.toJSON());
        if (!result.ok) {
          await subscription.unsubscribe();
          return void toast.error(t("error"));
        }
        setState("on");
        toast.success(t("enabled"));
      } catch {
        toast.error(t("error"));
      }
    });

  const disable = () =>
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    });

  if (state === "loading") return null;
  if (state === "unsupported" || state === "denied") {
    return <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{t(state)}</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-secondary px-4 py-3">
      {state === "on" ? <Bell className="size-5 text-primary" aria-hidden /> : <BellOff className="size-5 text-muted-foreground" aria-hidden />}
      <p className="min-w-0 flex-1 text-sm font-semibold">{state === "on" ? t("onText") : t("offText")}</p>
      <Button variant={state === "on" ? "outline" : "brand"} size="lg" onClick={state === "on" ? disable : enable} disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {state === "on" ? t("disable") : t("enable")}
      </Button>
    </div>
  );
}
