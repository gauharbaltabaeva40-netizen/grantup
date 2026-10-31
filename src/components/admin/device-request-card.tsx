"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Copy, KeyRound, Loader2, MapPin, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FormMessage } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type AdminErrorKey,
  approveDeviceRequest,
  rejectDeviceRequest,
  revokeDevice,
} from "@/lib/admin/actions";
import { CODE_TTL_HOURS_PUBLIC } from "@/lib/device/constants";
import { cn } from "@/lib/utils";

export type RequestView = {
  id: string;
  user_id: string;
  label: string;
  city: string | null;
  ip: string | null;
  status: "pending" | "approved" | "blocked" | string;
  failed_attempts: number;
  created_at: string;
  studentName: string;
  studentEmail: string;
  activeDevices: { id: string; label: string; last_seen_at: string; last_city: string | null }[];
};

export function DeviceRequestCard({ request }: { request: RequestView }) {
  const t = useTranslations("admin.devices");
  const te = useTranslations("admin.errors");
  const format = useFormatter();
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<AdminErrorKey | null>(null);
  const [pending, startTransition] = useTransition();

  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const needsChoice = request.activeDevices.length >= 2;
  const status = request.status as "pending" | "approved" | "blocked";

  function approve() {
    startTransition(async () => {
      setError(null);
      const result = await approveDeviceRequest(request.id, replaceId);
      if (result.ok && result.data) setCode(result.data.code);
      else if (!result.ok) setError(result.error);
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectDeviceRequest(request.id);
      if (!result.ok) setError(result.error);
    });
  }

  function revoke(deviceId: string) {
    startTransition(async () => {
      const result = await revokeDevice(deviceId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <Card className="rounded-2xl shadow-soft ring-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base font-bold">{request.studentName}</CardTitle>
            <p className="truncate text-sm text-muted-foreground">{request.studentEmail}</p>
          </div>
          <Badge variant={status === "blocked" ? "destructive" : status === "approved" ? "default" : "secondary"}>
            {t(`status.${status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-secondary p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">{t("newDevice")}</p>
          <p className="mt-1 flex items-center gap-2 font-semibold">
            <Smartphone className="size-4 text-primary" aria-hidden />
            {request.label}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{t("requested", { date: date(request.created_at) })}</span>
            {(request.city || request.ip) && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {[request.city, request.ip].filter(Boolean).join(" · ")}
              </span>
            )}
            {request.failed_attempts > 0 && <span className="text-danger">{t("attempts", { count: request.failed_attempts })}</span>}
          </p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            {needsChoice ? t("chooseReplace") : t("activeDevices")}
          </legend>
          {request.activeDevices.length === 0 && <p className="text-sm text-muted-foreground">{t("noActive")}</p>}
          <ul className="space-y-2">
            {request.activeDevices.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <label
                  className={cn(
                    "flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                    replaceId === d.id && "border-danger bg-danger/5",
                  )}
                >
                  <input
                    type="radio"
                    name={`replace-${request.id}`}
                    checked={replaceId === d.id}
                    onChange={() => setReplaceId(d.id)}
                    className="size-4 accent-[var(--danger)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{d.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t("lastSeen", { date: date(d.last_seen_at) })}
                      {d.last_city ? ` · ${d.last_city}` : ""}
                    </span>
                  </span>
                </label>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label={t("revoke")}
                  title={t("revoke")}
                  disabled={pending}
                  onClick={() => revoke(d.id)}
                >
                  <Trash2 className="text-danger" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </fieldset>

        {error && <FormMessage>{te(error)}</FormMessage>}

        {code ? (
          <div className="rounded-2xl border-2 border-dashed border-primary p-4 text-center">
            <p className="text-sm font-semibold text-muted-foreground">{t("codeTitle")}</p>
            <p className="my-2 text-4xl font-extrabold tracking-[0.3em] text-primary tabular-nums">{code}</p>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigator.clipboard.writeText(code).then(() => toast.success(code))}
            >
              <Copy aria-hidden />
              {t("copy")}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">{t("codeHint", { hours: CODE_TTL_HOURS_PUBLIC })}</p>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="brand"
              size="xl"
              className="flex-1"
              disabled={pending || (needsChoice && !replaceId)}
              onClick={approve}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
              {status === "pending" ? t("approve") : t("reapprove")}
            </Button>
            <Button variant="outline" size="xl" disabled={pending} onClick={reject}>
              {t("reject")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
