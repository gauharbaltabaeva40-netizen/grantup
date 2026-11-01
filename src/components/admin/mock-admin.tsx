"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMockExam, deleteMockExam, replaceMockQuestion, updateMockExam } from "@/lib/admin/mock-actions";
import { inputClass } from "./ui";
import { useAdminAction } from "./use-admin-action";

const labelClass = "space-y-1 text-xs font-semibold text-muted-foreground";

export function CreateMockForm({ nextNumber }: { nextNumber: number }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState({
    title_kk: `Сынақ ҰБТ №${nextNumber}`,
    title_ru: `Пробный ЕНТ №${nextNumber}`,
    locale: "kk" as "kk" | "ru",
    is_free: false,
    allowPartial: false,
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createMockExam(v), "Вариант құрастырылды", (data) => data && router.push(`/admin/mocks/${data.id}`));
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={labelClass}>
          Атауы (қаз)
          <input className={inputClass} value={v.title_kk} onChange={(e) => setV({ ...v, title_kk: e.target.value })} required />
        </label>
        <label className={labelClass}>
          Атауы (орыс)
          <input className={inputClass} value={v.title_ru} onChange={(e) => setV({ ...v, title_ru: e.target.value })} required />
        </label>
        <label className={labelClass}>
          Сұрақтар тілі
          <select className={inputClass} value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value as "kk" | "ru" })}>
            <option value="kk">Қазақша</option>
            <option value="ru">Орысша</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-primary" checked={v.is_free} onChange={(e) => setV({ ...v, is_free: e.target.checked })} />
          Тегін вариант
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-primary" checked={v.allowPartial} onChange={(e) => setV({ ...v, allowPartial: e.target.checked })} />
          Сұрақ жетпесе де жасау (жоба ретінде)
        </label>
      </div>
      <Button type="submit" variant="brand" size="xl" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
        Құрылым бойынша құрастыру
      </Button>
    </form>
  );
}

export function MockSettingsForm({ mock }: { mock: { id: string; title_kk: string; title_ru: string; is_free: boolean; is_published: boolean } }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [v, setV] = useState(mock);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateMockExam(v), "Сақталды");
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Атауы (қаз)
          <input className={inputClass} value={v.title_kk} onChange={(e) => setV({ ...v, title_kk: e.target.value })} required />
        </label>
        <label className={labelClass}>
          Атауы (орыс)
          <input className={inputClass} value={v.title_ru} onChange={(e) => setV({ ...v, title_ru: e.target.value })} required />
        </label>
      </div>
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-primary" checked={v.is_published} onChange={(e) => setV({ ...v, is_published: e.target.checked })} />
          Жарияланған (оқушыларға көрінеді)
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-primary" checked={v.is_free} onChange={(e) => setV({ ...v, is_free: e.target.checked })} />
          Тегін вариант
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="brand" size="xl" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Сақтау
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="xl"
          disabled={pending}
          onClick={() => confirm("Вариантты өшіру керек пе?") && run(() => deleteMockExam(mock.id), "Вариант өшірілді", () => router.replace("/admin/mocks"))}
        >
          Өшіру
        </Button>
      </div>
    </form>
  );
}

export function ReplaceQuestionButton({ mockId, questionId }: { mockId: string; questionId: string }) {
  const { pending, run } = useAdminAction();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Басқа сұрақпен ауыстыру"
      title="Басқа сұрақпен ауыстыру"
      disabled={pending}
      onClick={() => run(() => replaceMockQuestion(mockId, questionId), "Сұрақ ауыстырылды")}
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
    </Button>
  );
}
