import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveStreak, levelInfo } from "@/lib/gamification/levels";

const L = [
  { level: 1, xp: 0, name_kk: "Бастаушы", name_ru: "Новичок" },
  { level: 2, xp: 100, name_kk: "Ізденуші", name_ru: "Искатель" },
  { level: 3, xp: 300, name_kk: "Талапкер", name_ru: "Абитуриент" },
];

test("деңгей және прогресс", () => {
  assert.deepEqual(levelInfo(50, 1, L, "kk"), { level: 1, name: "Бастаушы", progress: 50, xpToNext: 50 });
  assert.deepEqual(levelInfo(200, 2, L, "ru"), { level: 2, name: "Искатель", progress: 50, xpToNext: 100 });
  assert.equal(levelInfo(999, 3, L, "kk").xpToNext, null);
});

test("streak: бүгін/кеше белсенді, күн өткізу, мұздату", () => {
  assert.equal(effectiveStreak(5, "2026-11-01", 0, "2026-11-01"), 5);
  assert.equal(effectiveStreak(5, "2026-10-31", 0, "2026-11-01"), 5);
  assert.equal(effectiveStreak(5, "2026-10-30", 0, "2026-11-01"), 0);
  assert.equal(effectiveStreak(5, "2026-10-30", 1, "2026-11-01"), 5);
  assert.equal(effectiveStreak(5, "2026-10-29", 1, "2026-11-01"), 0);
  assert.equal(effectiveStreak(0, null, 0, "2026-11-01"), 0);
});
