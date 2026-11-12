import assert from "node:assert/strict";
import { test } from "node:test";
import { headYaw, isTurnedAway, median } from "@/lib/proctoring/head-pose";
import { LOOK_AWAY_YAW } from "@/lib/proctoring/constants";

const face = (noseX: number, eyeGap = 0.1) => [
  { x: 0.5 - eyeGap / 2, y: 0.4 },
  { x: 0.5 + eyeGap / 2, y: 0.4 },
  { x: noseX, y: 0.47 },
];

test("headYaw: тура қарағанда ≈ 0, бұрылғанда өседі", () => {
  assert.equal(headYaw(face(0.5)), 0);
  assert.ok(Math.abs(headYaw(face(0.545))!) > LOOK_AWAY_YAW);
  assert.equal(headYaw(undefined), null);
  assert.equal(headYaw(face(0.5, 0.001)), null);
});

test("isTurnedAway: оқушының өз қалпынан ауытқу ғана есептеледі", () => {
  const baseline = 0.12; // оқушы камераға сәл қисық отыр
  assert.equal(isTurnedAway(0.15, baseline, LOOK_AWAY_YAW), false);
  assert.equal(isTurnedAway(0.6, baseline, LOOK_AWAY_YAW), true);
  assert.equal(isTurnedAway(-0.3, baseline, LOOK_AWAY_YAW), true);
  assert.equal(isTurnedAway(0.6, null, LOOK_AWAY_YAW), false);
});

test("median", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});
