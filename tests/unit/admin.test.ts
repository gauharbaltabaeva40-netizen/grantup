import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGrantCsv } from "@/lib/admin/grant-csv";
import { pickSection, type PoolQuestion } from "@/lib/admin/mock-builder";
import { normalizeImportRow, parseCorrect } from "@/lib/admin/question-import";
import { validateSetting } from "@/lib/admin/settings-schemas";
import { parseYoutubeId } from "@/lib/admin/youtube";

test("YouTube сілтемесінен ID", () => {
  const id = "dQw4w9WgXcQ";
  for (const input of [
    id,
    `https://youtu.be/${id}?t=10`,
    `https://www.youtube.com/watch?v=${id}&list=x`,
    `youtube.com/shorts/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://m.youtube.com/live/${id}?feature=share`,
  ]) {
    assert.equal(parseYoutubeId(input), id, input);
  }
  for (const bad of [`https://evil.com/watch?v=${id}`, "https://youtu.be/short", ""]) assert.equal(parseYoutubeId(bad), null, bad);
});

test("импорт: дұрыс жауапты талдау", () => {
  assert.deepEqual(parseCorrect("A", 4), [0]);
  assert.deepEqual(parseCorrect("a, c", 4), [0, 2]);
  assert.deepEqual(parseCorrect("1;3", 4), [0, 2]);
  assert.deepEqual(parseCorrect("AC", 4), [0, 2]);
  assert.equal(parseCorrect("E", 4), null);
  assert.equal(parseCorrect("", 4), null);
});

test("импорт: жолды тексеру", () => {
  const S = ["math", "informatics"];
  const ok = normalizeImportRow({ subject: "Math", stem: "$2+2$?", A: 3, B: 4, C: 5, correct: "B" }, S);
  assert.equal(ok?.row?.type, "single");
  assert.equal(ok?.row?.locale, "kk");
  assert.deepEqual(ok?.row?.correct, [1]);

  const multi = normalizeImportRow({ "Пән": "informatics", "Сұрақ": "q", "Нұсқа 1": "a", "нұсқа 2": "b", "нұсқа 3": "c", "Дұрыс": "1,3", "Тіл": "ru" }, S);
  assert.equal(multi?.row?.type, "multiple");
  assert.equal(multi?.row?.locale, "ru");

  assert.equal(normalizeImportRow({ subject: "math", stem: "q", A: "a", B: "b", type: "single", correct: "A,B" }, S)?.row, null);
  assert.equal(normalizeImportRow({ subject: "math", stem: "q", A: "a", C: "c", correct: "A" }, S)?.row, null);
  assert.match(normalizeImportRow({ subject: "bio", stem: "q", A: "a", B: "b", correct: "A" }, S)!.errors[0], /bio/);
  assert.equal(normalizeImportRow({ subject: "math", stem: "", A: "" }, S), null);
  assert.equal(normalizeImportRow({ subject: "math", stem: "q", A: "a", B: "b", correct: "A", difficulty: "5" }, S)?.row, null);
  assert.ok(normalizeImportRow({ A: "a", B: "b" }, S)!.errors.length >= 3);
});

test("сынақ құрастыру: құрам, контекстік мәтіндер дәл, аз қолданылғандары бірінші", () => {
  const pool: PoolQuestion[] = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: `s${i}`, type: "single" as const, group_id: null })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, type: "multiple" as const, group_id: null })),
    ...["g1", "g1", "g1", "g2", "g2", "g3", "g3", "g3", "g3"].map((g, i) => ({ id: `c${i}`, type: "single" as const, group_id: g })),
  ];
  const r = pickSection(pool, { single: 25, context: 5, multiple: 10 });
  assert.equal(r.ids.length, 40);
  assert.deepEqual(r.shortages, []);
  assert.equal(new Set(r.ids).size, 40);
  assert.deepEqual(r.ids.filter((id) => id.startsWith("c")).sort(), ["c0", "c1", "c2", "c3", "c4"]);

  const usage = new Map(Array.from({ length: 25 }, (_, i) => [`s${i}`, 3] as [string, number]));
  assert.deepEqual(pickSection(pool, { single: 5 }, usage).ids.sort(), ["s25", "s26", "s27", "s28", "s29"]);

  const short = pickSection(pool, { single: 40, context: 10, multiple: 10 });
  assert.equal(short.shortages.find((s) => s.kind === "single")?.have, 30);
  assert.equal(short.shortages.find((s) => s.kind === "context")?.have, 9);
  assert.equal(pickSection(pool, { context: 4 }).ids.length, 4);
});

test("баптаулар: JSON және құрылым тексеру", () => {
  assert.equal(validateSetting("xp", "{bad").ok, false);
  assert.equal(validateSetting("league", '{"groupSize":10,"promote":6,"demote":5}').ok, false);
  const loose = validateSetting("league", JSON.stringify({ groupSize: 30, promote: 7, demote: 5, timezone: "Asia/Almaty" }));
  assert.ok(loose.ok && (loose.value as { timezone: string }).timezone === "Asia/Almaty");
  const levels = '[{"level":1,"xp":0,"name_kk":"a","name_ru":"b"},{"level":2,"xp":0,"name_kk":"a","name_ru":"b"}]';
  assert.equal(validateSetting("levels", levels).ok, false);
});

test("CSV доступ: тақырып, күн форматтары, қателер", () => {
  const rows = parseGrantCsv("email\naru@mail.kz\nbekzat@gmail.com, 01.09.2026, 31.05.2027, 11-сынып\nbad-email\nx@y.kz, 2026-09-01, 2026-08-01", {
    startsAt: "2026-11-01",
    endsAt: "2027-01-30",
  });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], { line: 2, email: "aru@mail.kz", startsAt: "2026-11-01", endsAt: "2027-01-30", note: "", error: null });
  assert.equal(rows[1].startsAt, "2026-09-01");
  assert.equal(rows[1].endsAt, "2027-05-31");
  assert.equal(rows[1].note, "11-сынып");
  assert.ok(rows[2].error);
  assert.ok(rows[3].error);
});
