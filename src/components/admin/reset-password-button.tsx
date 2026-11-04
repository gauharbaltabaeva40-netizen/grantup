"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { resetStudentPassword } from "@/lib/admin/actions";
import { useAdminAction } from "./use-admin-action";

/** Уақытша құпиясөз: бір рет көрсетіледі, терезе жабылғаннан кейін қайта көру мүмкін емес. */
export function ResetPasswordButton({ userId, studentName }: { userId: string; studentName: string }) {
  const { pending, run } = useAdminAction();
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const start = () => {
    if (!confirm(`${studentName} үшін жаңа уақытша құпиясөз жасалсын ба?\n\nЕскі құпиясөз жұмыс істемей қалады, оқушының барлық сессиясы жабылады.`)) return;
    run(() => resetStudentPassword(userId), undefined, (data) => {
      if (data) setPassword(data.password);
    });
  };

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      <Button variant="outline" onClick={start} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
        Уақытша құпиясөз беру
      </Button>

      <Dialog
        open={password !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPassword(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>Уақытша құпиясөз</DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            {studentName} осымен кіреді, содан кейін өз құпиясөзін қоюы сұралады.
          </DialogDescription>
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-muted p-3">
            <code className="min-w-0 flex-1 text-center font-mono text-2xl font-bold tracking-wider select-all">{password}</code>
            <Button variant="secondary" size="lg" onClick={copy}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Көшірілді" : "Көшіру"}
            </Button>
          </div>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-streak/12 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Бұл құпиясөз тек қазір көрсетіледі және ешқайда сақталмайды. Оқушыға жеке хабарламамен жіберіңіз.
          </p>
          <Button variant="brand" size="xl" className="mt-4 w-full" onClick={() => setPassword(null)}>
            Дайын
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
