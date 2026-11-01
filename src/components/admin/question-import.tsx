"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { importQuestions } from "@/lib/admin/question-actions";
import { normalizeImportRow, OPTION_LETTERS, TEMPLATE_HEADERS } from "@/lib/admin/question-import";
import { cn } from "@/lib/utils";
import { useAdminAction } from "./use-admin-action";

type Parsed = { line: number; raw: Record<string, unknown>; stem: string; subject: string; type: string; options: number; correct: string; errors: string[] };

const MAX_ROWS = 500;

export function QuestionImport({ subjects }: { subjects: { code: string; title: string }[] }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Parsed[]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const codes = subjects.map((s) => s.code);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const example = [
      TEMPLATE_HEADERS,
      ["math", "", "kk", "single", 2, "$2x + 3 = 11$ теңдеуінің түбірі?", "3", "4", "5", "7", "", "", "", "", "B", "$2x = 8$, сондықтан $x = 4$."],
      ["informatics", "", "kk", "multiple", 2, "Қайсысы бағдарламалау тілі?", "Python", "HTML", "Java", "CSS", "C++", "JSON", "", "", "A,C,E", ""],
    ];
    const help = [
      ["Баған", "Мәні"],
      ["subject", `Пән коды: ${codes.join(", ")}`],
      ["topic", "Тақырып атауы (міндетті емес, пәндегі атаумен дәл сәйкес)"],
      ["locale", "kk немесе ru (бос болса kk)"],
      ["type", "single — бір жауап, multiple — бірнеше жауап (бос болса — дұрыс жауап санынан анықталады)"],
      ["difficulty", "1, 2 немесе 3 (бос болса 2)"],
      ["stem", "Сұрақ мәтіні. Формула: $x^2$ немесе $$\\frac{a}{b}$$"],
      ["A … H", "Нұсқалар (кемінде 2, қатарынан)"],
      ["correct", "Дұрыс жауап(тар): A немесе A,C"],
      ["explanation", "Түсіндірме (міндетті емес)"],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(example), "Сұрақтар");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(help), "Нұсқаулық");
    XLSX.writeFile(wb, "grantup-questions-template.xlsx");
  }

  async function onFile(file: File | undefined) {
    setRows([]);
    setReadError(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setReadError("Файл 5 МБ-тан аспауы керек.");
    setReading(true);
    try {
      const XLSX = await import("xlsx");
      const isCsv = /\.csv$/i.test(file.name);
      const wb = isCsv ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false, blankrows: true });
      const parsed: Parsed[] = [];
      json.forEach((raw, i) => {
        const result = normalizeImportRow(raw, codes);
        if (!result) return;
        parsed.push({
          line: i + 2,
          raw,
          stem: result.row?.stem ?? String(raw.stem ?? raw["сұрақ"] ?? ""),
          subject: result.row?.subject ?? String(raw.subject ?? ""),
          type: result.row?.type ?? "—",
          options: result.row?.options.length ?? 0,
          correct: result.row ? result.row.correct.map((c) => OPTION_LETTERS[c]).join(",") : "—",
          errors: result.errors,
        });
      });
      setFileName(file.name);
      setRows(parsed);
      if (parsed.length === 0) setReadError("Файлда сұрақ табылмады — бірінші парақтың бірінші жолы баған атаулары болуы керек.");
    } catch {
      setReadError("Файлды оқу мүмкін болмады. .xlsx немесе UTF-8 .csv екенін тексеріңіз.");
    } finally {
      setReading(false);
    }
  }

  const invalid = rows.filter((r) => r.errors.length);

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Үлгіні жүктеп алыңыз және «Сұрақтар» парағын толтырыңыз («Нұсқаулық» парағында әр бағанның түсіндірмесі бар).</li>
        <li>Файлды таңдаңыз — әр жол тексеріледі, қателер қызылмен көрсетіледі.</li>
        <li>Қате жоқ болса — «Импорттау» батырмасы. Бір жол қате болса, ештеңе сақталмайды.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10" onClick={downloadTemplate}>
          <Download aria-hidden /> Үлгіні жүктеу (.xlsx)
        </Button>
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input px-4 text-sm font-semibold hover:bg-muted">
          {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          Файл таңдау (.xlsx, .csv)
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {readError && <p className="text-sm font-semibold text-danger">{readError}</p>}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{fileName}</span>
            <Badge variant="secondary">Жол: {rows.length}</Badge>
            <Badge variant={invalid.length ? "destructive" : "default"}>Қате: {invalid.length}</Badge>
            {rows.length > MAX_ROWS && <Badge variant="destructive">Шек — {MAX_ROWS} жол</Badge>}
          </div>
          <div className="max-h-[28rem] overflow-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Жол</th>
                  <th className="px-3 py-2">Пән</th>
                  <th className="px-3 py-2">Сұрақ</th>
                  <th className="px-3 py-2">Түрі</th>
                  <th className="px-3 py-2">Нұсқа</th>
                  <th className="px-3 py-2">Дұрыс</th>
                  <th className="px-3 py-2">Күйі</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.line} className={cn(r.errors.length && "bg-danger/5")}>
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.line}</td>
                    <td className="px-3 py-1.5">{r.subject || "—"}</td>
                    <td className="max-w-xs truncate px-3 py-1.5">{r.stem || "—"}</td>
                    <td className="px-3 py-1.5">{r.type}</td>
                    <td className="px-3 py-1.5 tabular-nums">{r.options}</td>
                    <td className="px-3 py-1.5">{r.correct}</td>
                    <td className={cn("px-3 py-1.5", r.errors.length ? "font-semibold text-danger" : "text-success")}>
                      {r.errors.length ? r.errors.join("; ") : "Дұрыс"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            variant="brand"
            size="xl"
            disabled={pending || invalid.length > 0 || rows.length > MAX_ROWS}
            onClick={() =>
              run(
                () => importQuestions({ fileName, rows: rows.map((r) => ({ ...r.raw, __line: r.line })) }),
                `${rows.length} сұрақ импортталды`,
                () => router.push("/admin/questions"),
              )
            }
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {rows.length} сұрақты импорттау
          </Button>
        </>
      )}
    </div>
  );
}
