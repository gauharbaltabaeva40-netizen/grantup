// CSV арқылы көп оқушыға доступ беру: жолдарды талдау (клиентте алдын ала қарау үшін).

export type GrantCsvRow = { line: number; email: string; startsAt: string; endsAt: string; note: string; error: string | null };

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
export function parseGrantCsv(text: string, defaults: { startsAt: string; endsAt: string }): GrantCsvRow[] {
  const rows: GrantCsvRow[] = [];
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
