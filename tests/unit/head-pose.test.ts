import assert from "node:assert/strict";
import { test } from "node:test";
import { headYaw, isLookingAway, isTurnedAway, median, sideGaze, yawFromMatrix } from "@/lib/proctoring/head-pose";
import { LOOK_AWAY_GAZE, LOOK_AWAY_YAW_DEG, LOOK_AWAY_YAW_FALLBACK as LOOK_AWAY_YAW } from "@/lib/proctoring/constants";

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

/** Y осі бойынша бұру матрицасы (бағаналар бойынша), бұрыш градуспен */
function rotY(deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

test("yawFromMatrix: бұрышты дұрыс қайтарады", () => {
  assert.ok(Math.abs(yawFromMatrix(rotY(0))!) < 1e-9);
  assert.ok(Math.abs(yawFromMatrix(rotY(30))! - 30) < 1e-6);
  assert.ok(Math.abs(yawFromMatrix(rotY(-45))! + 45) < 1e-6);
  assert.equal(yawFromMatrix([1, 2]), null);
});

test("isLookingAway: нақты кадрлардан алынған мәндер (тура / сәл бұрылып жанына қарау / қатты бұрылу)", () => {
  const limits = { yawDeg: LOOK_AWAY_YAW_DEG, gaze: LOOK_AWAY_GAZE };
  const baseline = 9.9; // тура қарағандағы кадр
  assert.equal(isLookingAway({ yaw: 9.9, gaze: 0.21 }, baseline, limits), false);
  assert.equal(isLookingAway({ yaw: 29.8, gaze: 0.68 }, baseline, limits), true);
  assert.equal(isLookingAway({ yaw: 51, gaze: 0.54 }, baseline, limits), true);
  assert.equal(isLookingAway({ yaw: 15, gaze: 0.4 }, baseline, limits), false); // экранда жолды оқу
  assert.equal(isLookingAway({ yaw: 51, gaze: 0.9 }, null, limits), false);
});

test("sideGaze: тек көлденең бағыттар есептеледі", () => {
  assert.equal(sideGaze([{ categoryName: "eyeLookInLeft", score: 0.68 }, { categoryName: "eyeLookDownLeft", score: 0.9 }]), 0.68);
  assert.equal(sideGaze(undefined), 0);
});
