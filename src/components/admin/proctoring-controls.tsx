"use client";

import Link from "next/link";
import { BadgeCheck, Ban, ExternalLink, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { approveCertificate, revokeCertificate, setProctoringEventDismissed } from "@/lib/admin/proctoring-actions";
import { useAdminAction } from "./use-admin-action";

/** Бұзушылықты «қате дабыл» деп белгілеу / белгіні алу */
export function DismissEventButton({ eventId, dismissed }: { eventId: number; dismissed: boolean }) {
  const { pending, run } = useAdminAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => setProctoringEventDismissed(eventId, !dismissed), dismissed ? "Белгі алынды" : "Қате дабыл деп белгіленді")}
    >
      {dismissed ? <Undo2 aria-hidden /> : <X aria-hidden />}
      {dismissed ? "Қайтару" : "Қате дабыл"}
    </Button>
  );
}

/** Сертификат: беру / жою; берілген болса — тексеру бетіне сілтеме */
export function CertificateControls({ attemptId, status, code }: { attemptId: string; status: "valid" | "revoked" | null; code: string | null }) {
  const { pending, run } = useAdminAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "valid" && code && (
        <Link href={`/verify/${code}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Сертификатты ашу <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      )}
      {status !== "valid" && (
        <Button size="sm" variant="brand" disabled={pending} onClick={() => run(() => approveCertificate(attemptId), "Сертификат берілді")}>
          <BadgeCheck aria-hidden /> Сертификат беру
        </Button>
      )}
      {status !== "revoked" && (
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            if (confirm("Сертификатты жою керек пе? Тексеру беті оны «жарамсыз» деп көрсетеді.")) run(() => revokeCertificate(attemptId), "Сертификат жойылды");
          }}
        >
          <Ban aria-hidden /> {status === "valid" ? "Жою" : "Бермеу"}
        </Button>
      )}
    </div>
  );
}
