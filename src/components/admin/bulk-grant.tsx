"use client";

import { useMemo, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bulkGrantAccess } from "@/lib/admin/actions";
import { useAdminAction } from "./use-admin-action";
import { textareaClass } from "./ui";

type Row = { line: number; email: string; startsAt: string; endsAt: string; note: string; error: string | null };

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** YYYY-MM-DD немесе DD.MM.YYYY → YYYY-MM-DD; қате болса null */
function normalizeDate(value: string): string | null {
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const dotted = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(v);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : dotted ? [dotted[3], dotted[2].padStart(2, "0"), dotted[1].padStart(2, "0")] : [];
  if (!y) return null;
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== `${y}-${m}-${d}` ? null : `${y}-${m}-${d}`;
}

/**
 * CSV жолдарын талдау: email[,басталуы][,аяқталуы][,ескертпе]. Бөлгіш — үтір, нүктелі үтір немесе tab.
 * Бірінші жол тақырып болса (email емес) — өткізіледі. Күндер берілмесе — формадағы әдепкі күндер.
 */
export function parseGrantCsv(text: string, defaults: { startsAt: string; endsAt: string }): Row[] {
  const rows: Row[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const cells = raw.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (!cells[0]) return;
    if (index === 0 && !EMAIL_RE.test(cells[0]) && /mail|почта|пошта/i.test(cells[0])) return;
    const email = cells[0].toLowerCase();
    const startsAt = cells[1] ? normalizeDate(cells[1]) : defaults.startsAt;
    const endsAt = cells[2] ? normalizeDate(cells[2]) : defaults.endsAt;
    let error: string | null = null;
    if (!EMAIL_RE.test(email)) error = "Email қате";
    else if (!startsAt) error = "Басталу күні қате";
    else if (!endsAt) error = "Аяқталу күні қате";
    else if (endsAt <= startsAt) error = "Аяқталуы басталуынан кейін болуы керек";
    rows.push({ line: index + 1, email, startsAt: startsAt ?? "", endsAt: endsAt ?? "", note: (cells[3] ?? "").slice(0, 500), error });
  });
  return rows;
}

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
