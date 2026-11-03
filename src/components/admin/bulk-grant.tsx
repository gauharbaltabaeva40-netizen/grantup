"use client";

import { useMemo, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkGrantAccess } from "@/lib/admin/actions";
import { parseGrantCsv } from "@/lib/admin/grant-csv";
import { useAdminAction } from "./use-admin-action";
import { textareaClass } from "./ui";

export function BulkGrantForm({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const [text, setText] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [endsAt, setEndsAt] = useState(defaultEnd);
  const { pending, run } = useAdminAction();

  const rows = useMemo(() => parseGrantCsv(text, { startsAt, endsAt }), [text, startsAt, endsAt]);
  const invalid = rows.filter((r) => r.error);
  const duplicates = rows.length - new Set(rows.map((r) => r.email)).size;

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) return setText("");
    setText(await file.text());
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Әр жол: <code className="rounded bg-muted px-1">email, басталуы, аяқталуы, ескертпе</code>. Тек email жазсаңыз болады — күндер
        төмендегі әдепкі мәндерден алынады. Күн форматы: 2026-09-01 немесе 01.09.2026.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="bulk-file">CSV файл</Label>
          <label
            htmlFor="bulk-file"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            <FileUp className="size-4" aria-hidden /> Файл таңдау
          </label>
          <input id="bulk-file" type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-start">Әдепкі басталуы</Label>
          <Input id="bulk-start" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bulk-end">Әдепкі аяқталуы (қоса)</Label>
          <Input id="bulk-end" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
      </div>
      <textarea
        aria-label="CSV мәтіні"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={"aru@mail.kz\nbekzat@gmail.com, 2026-09-01, 2027-05-31, 11-сынып"}
        className={textareaClass}
      />

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">Барлығы: {rows.length}</Badge>
            <Badge variant={invalid.length ? "destructive" : "default"}>Қате: {invalid.length}</Badge>
            {duplicates > 0 && <Badge variant="outline">Қайталанған email: {duplicates}</Badge>}
          </div>
          <div className="max-h-64 overflow-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Жол</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Кезең</th>
                  <th className="px-3 py-2">Күйі</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.line} className={r.error ? "bg-danger/5" : undefined}>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.line}</td>
                    <td className="px-3 py-1.5">{r.email}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {r.startsAt || "—"} — {r.endsAt || "—"}
                    </td>
                    <td className={r.error ? "px-3 py-1.5 font-semibold text-danger" : "px-3 py-1.5 text-success"}>{r.error ?? "Дұрыс"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Button
        variant="brand"
        size="xl"
        disabled={pending || rows.length === 0 || invalid.length > 0 || rows.length > 1000}
        onClick={() =>
          run(
            () => bulkGrantAccess(rows.map(({ email, startsAt: s, endsAt: e, note }) => ({ email, startsAt: s, endsAt: e, note }))),
            `${rows.length} оқушыға доступ берілді`,
            () => setText(""),
          )
        }
      >
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {rows.length ? `${rows.length} оқушыға доступ беру` : "Доступ беру"}
      </Button>
      {rows.length > 1000 && <p className="text-sm text-danger">Бір реттік шек — 1000 жол.</p>}
    </div>
  );
}
