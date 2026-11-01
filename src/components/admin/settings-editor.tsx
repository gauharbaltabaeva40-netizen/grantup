"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteSpecialty, saveSetting, saveSpecialty } from "@/lib/admin/settings-actions";
import { type SettingKey, validateSetting } from "@/lib/admin/settings-schemas";
import { inputClass, textareaClass } from "./ui";
import { useAdminAction } from "./use-admin-action";

export function SettingEditor({ settingKey, value, description, updatedAt }: { settingKey: SettingKey; value: string; description: string | null; updatedAt: string }) {
  const { pending, run } = useAdminAction();
  const [text, setText] = useState(value);
  const check = validateSetting(settingKey, text);
  const dirty = text !== value;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-mono text-sm font-bold">{settingKey}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <span className="text-xs text-muted-foreground">Жаңартылды: {updatedAt}</span>
      </div>
      <textarea
        aria-label={settingKey}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(24, Math.max(4, text.split("\n").length + 1))}
        spellCheck={false}
        className={`${textareaClass} text-xs leading-relaxed ${check.ok ? "" : "border-danger"}`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="brand" className="h-10" disabled={pending || !dirty || !check.ok} onClick={() => run(() => saveSetting(settingKey, text), `${settingKey} сақталды`)}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Сақтау
        </Button>
        {dirty && (
          <Button variant="ghost" className="h-10" onClick={() => setText(value)}>
            Қайтару
          </Button>
        )}
        {!check.ok && <span className="text-sm font-semibold text-danger">{check.message}</span>}
      </div>
    </div>
  );
}

export type SpecialtyRow = {
  id?: string;
  code: string;
  name_kk: string;
  name_ru: string;
  subject_pair: string;
  threshold_score: number;
  year: number;
  is_active: boolean;
};

function SpecialtyForm({ initial, onDone }: { initial: SpecialtyRow; onDone?: () => void }) {
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(initial);
  const isNew = !initial.id;

  return (
    <form
      className="grid gap-2 py-3 sm:grid-cols-[6rem_1fr_1fr_5rem_5rem_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveSpecialty(v), isNew ? "Мамандық қосылды" : "Сақталды", () => {
          if (isNew) setV(initial);
          onDone?.();
        });
      }}
    >
      <input aria-label="Коды" placeholder="B057" className={inputClass} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} required />
      <input aria-label="Атауы (қаз)" placeholder="Атауы (қаз)" className={inputClass} value={v.name_kk} onChange={(e) => setV({ ...v, name_kk: e.target.value })} required />
      <input aria-label="Атауы (орыс)" placeholder="Атауы (орыс)" className={inputClass} value={v.name_ru} onChange={(e) => setV({ ...v, name_ru: e.target.value })} required />
      <input aria-label="Шекті балл" type="number" min={0} max={140} className={inputClass} value={v.threshold_score} onChange={(e) => setV({ ...v, threshold_score: Number(e.target.value) })} />
      <input aria-label="Жыл" type="number" min={2000} max={2100} className={inputClass} value={v.year} onChange={(e) => setV({ ...v, year: Number(e.target.value) })} />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold" title="Белсенді">
          <input type="checkbox" className="size-4 accent-primary" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} />
          Белсенді
        </label>
        <Button type="submit" variant={isNew ? "brand" : "outline"} className="h-10" disabled={pending}>
          {isNew ? <Plus aria-hidden /> : null}
          {isNew ? "Қосу" : "Сақтау"}
        </Button>
        {!isNew && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Өшіру"
            disabled={pending}
            onClick={() => confirm(`${v.code} мамандығын өшіру керек пе?`) && run(() => deleteSpecialty(initial.id!), "Мамандық өшірілді")}
          >
            <Trash2 aria-hidden className="text-danger" />
          </Button>
        )}
      </div>
    </form>
  );
}

export function SpecialtiesEditor({ rows, year }: { rows: SpecialtyRow[]; year: number }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        «Грантқа дейінгі жол» осы шекті балдармен есептеледі. <Badge variant="outline">Демо мәндерді</Badge> ресми мәндермен ауыстырыңыз.
      </p>
      <div className="hidden grid-cols-[6rem_1fr_1fr_5rem_5rem_auto] gap-2 text-xs font-semibold text-muted-foreground sm:grid">
        <span>Коды</span>
        <span>Атауы (қаз)</span>
        <span>Атауы (орыс)</span>
        <span>Балл</span>
        <span>Жыл</span>
        <span />
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <SpecialtyForm key={row.id} initial={row} />
        ))}
        <SpecialtyForm initial={{ code: "", name_kk: "", name_ru: "", subject_pair: "math_informatics", threshold_score: 100, year, is_active: true }} />
      </div>
    </div>
  );
}
