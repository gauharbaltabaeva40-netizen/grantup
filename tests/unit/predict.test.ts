import assert from "node:assert/strict";
import { test } from "node:test";
import { accuracyEstimate, easiestGain, predictScore } from "@/lib/grant/predict";

const subj = (subject: string, correct: number, total: number, maxPoints: number) => ({ subject, correct, total, maxPoints });
const full = [subj("history_kz", 10, 20, 20), subj("reading", 5, 10, 10), subj("mathlit", 5, 10, 10), subj("math", 20, 40, 50), subj("inf", 20, 40, 50)];

test("дерек жетпесе болжам жоқ", () => {
  assert.equal(predictScore([], [], 140), null);
  assert.equal(predictScore([], [subj("math", 5, 10, 50)], 140), null);
});

test("жаттығу дәлдігі бойынша", () => {
  assert.deepEqual(predictScore([], full, 140), { score: 70, basis: "practice" });
});

test("сынақ нәтижелері: масштаб, соңғысы маңыздырақ, тек соңғы 3", () => {
  assert.deepEqual(predictScore([{ score: 100, maxScore: 140, finishedAt: "2026-10-01" }], [], 140), { score: 100, basis: "mock" });
  assert.deepEqual(predictScore([{ score: 20, maxScore: 40, finishedAt: "2026-10-01" }], [], 140), { score: 70, basis: "mock" });
  assert.deepEqual(
    predictScore([{ score: 60, maxScore: 140, finishedAt: "2026-09-01" }, { score: 100, maxScore: 140, finishedAt: "2026-10-01" }], [], 140),
    { score: 85, basis: "mock" },
  );
  assert.deepEqual(predictScore([{ score: 100, maxScore: 140, finishedAt: "2026-10-01" }], full, 140), { score: 91, basis: "mock" });
  assert.deepEqual(
    predictScore(
      [
        { score: 0, maxScore: 140, finishedAt: "2026-01-01" },
        { score: 100, maxScore: 140, finishedAt: "2026-10-01" },
        { score: 100, maxScore: 140, finishedAt: "2026-10-02" },
        { score: 100, maxScore: 140, finishedAt: "2026-10-03" },
      ],
      [],
      140,
    ),
    { score: 100, basis: "mock" },
  );
});

test("дерегі аз пән 50% деп есептеледі; ең оңай өсу", () => {
  assert.equal(Math.round(accuracyEstimate([subj("a", 20, 20, 70), subj("b", 1, 1, 70)], 140)!), 105);
  assert.deepEqual(easiestGain([subj("history", 18, 20, 20), subj("math", 10, 40, 50), subj("inf", 30, 40, 50)]), { subject: "math", gain: 19 });
  assert.equal(easiestGain([subj("math", 0, 2, 50)]), null);
});
