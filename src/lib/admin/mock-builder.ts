// Сынақ ҰБТ-ны құрылым бойынша автоматты құрастыру (таза функция — тестіленеді).

import { shuffle } from "@/lib/quiz/grading";

export type PoolQuestion = { id: string; type: "single" | "multiple"; group_id: string | null };
export type Composition = Partial<Record<"single" | "context" | "multiple", number>>;
export type Shortage = { kind: "single" | "context" | "multiple"; need: number; have: number };

/** Аз қолданылғандары алдымен; тең болса — кездейсоқ рет */
function leastUsedFirst<T>(items: T[], usage: (item: T) => number, random: () => number): T[] {
  return shuffle(items, random).sort((a, b) => usage(a) - usage(b));
}

/**
 * Бір пәнге сұрақ таңдау:
 *  - single / multiple — контекстік мәтінсіз жеке сұрақтар;
 *  - context — контекстік мәтіндер толығымен (бір мәтіннің барлық сұрақтары бірге), саны дәл келуі керек.
 * usage — сұрақтың басқа сынақтарда неше рет қолданылғаны (қайталануды азайту үшін).
 */
export function pickSection(
  pool: PoolQuestion[],
  composition: Composition,
  usage: Map<string, number> = new Map(),
  random: () => number = Math.random,
): { ids: string[]; shortages: Shortage[] } {
  const used = (id: string) => usage.get(id) ?? 0;
  const ids: string[] = [];
  const shortages: Shortage[] = [];

  for (const kind of ["single", "multiple"] as const) {
    const need = composition[kind] ?? 0;
    if (!need) continue;
    const candidates = leastUsedFirst(
      pool.filter((q) => !q.group_id && q.type === kind),
      (q) => used(q.id),
      random,
    );
    ids.push(...candidates.slice(0, need).map((q) => q.id));
    if (candidates.length < need) shortages.push({ kind, need, have: candidates.length });
  }

  const needContext = composition.context ?? 0;
  if (needContext) {
    const groups = new Map<string, string[]>();
    for (const q of pool) if (q.group_id) groups.set(q.group_id, [...(groups.get(q.group_id) ?? []), q.id]);
    const ordered = leastUsedFirst([...groups.values()], (g) => Math.max(...g.map(used)), random);
    // Мәтіндердің сұрақ саны дәл need-ке тең болатын жиынын табамыз (subset sum).
    // Мәтіндер артықшылық ретімен қаралады, сондықтан аз қолданылғандары бірінші таңдалады.
    const best: (number[] | undefined)[] = [[]];
    ordered.forEach((group, index) => {
      for (let sum = needContext; sum >= group.length; sum--) {
        const prev = best[sum - group.length];
        if (prev && !best[sum]) best[sum] = [...prev, index];
      }
    });
    let reached = needContext;
    while (!best[reached]) reached--;
    for (const index of best[reached]!) ids.push(...ordered[index]);
    if (reached < needContext) shortages.push({ kind: "context", need: needContext, have: reached });
  }

  return { ids, shortages };
}

export const KIND_LABEL = { single: "бір жауапты", multiple: "көп жауапты", context: "контекстік" } as const;
