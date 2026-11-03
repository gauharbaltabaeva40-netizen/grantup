import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeAnswer, isEngaged, shuffle } from "@/lib/quiz/grading";

test("бір жауапты және контекстік сұрақтар", () => {
  assert.equal(gradeAnswer("single", ["a"], ["a"]).points, 1);
  assert.equal(gradeAnswer("single", ["a"], ["b"]).points, 0);
  assert.equal(gradeAnswer("single", ["a"], ["a", "b"]).points, 0);
  assert.equal(gradeAnswer("single", ["a"], []).isCorrect, false);
  assert.equal(gradeAnswer("context", ["a"], ["a"]).points, 1);
});

test("көп жауапты: қате саны → балл (2 / 1 / 0)", () => {
  assert.deepEqual(gradeAnswer("multiple", ["a", "b"], ["a", "b"]), { isCorrect: true, points: 2, maxPoints: 2, mistakes: 0 });
  assert.equal(gradeAnswer("multiple", ["a", "b"], ["a"]).points, 1);
  assert.equal(gradeAnswer("multiple", ["a", "b"], ["a", "b", "c"]).points, 1);
  assert.equal(gradeAnswer("multiple", ["a", "b"], ["a", "c"]).points, 0);
  assert.equal(gradeAnswer("multiple", ["a", "b"], []).points, 0);
  assert.equal(gradeAnswer("multiple", ["a", "b"], ["a", "b", "c", "d", "e"]).points, 0);
});

test("баптаулардағы бағалау ережесі", () => {
  const rules = { single: 1, context: 1, multiple: { maxPoints: 3, byMistakes: [3, 2, 1] } };
  assert.equal(gradeAnswer("multiple", ["a"], ["a", "b"], rules).points, 2);
});

test("shuffle элементтерді сақтайды", () => {
  assert.deepEqual([...shuffle([1, 2, 3, 4, 5])].sort(), [1, 2, 3, 4, 5]);
});

test("марапат тек сұрақтардың кемінде жартысына жауап берілсе", () => {
  assert.equal(isEngaged(0, 31), false);
  assert.equal(isEngaged(15, 31), false);
  assert.equal(isEngaged(16, 31), true);
  assert.equal(isEngaged(10, 20), true);
  assert.equal(isEngaged(0, 0), false);
});
