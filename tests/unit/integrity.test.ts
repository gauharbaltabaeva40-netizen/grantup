import assert from "node:assert/strict";
import { test } from "node:test";
import { CERT_MIN_INTEGRITY, integrityIndex, integrityTone } from "@/lib/proctoring/integrity";

test("integrityIndex: камерасыз сынақ — null", () => {
  assert.equal(integrityIndex([]), null);
  assert.equal(integrityIndex([{ type: "tab_hidden" }]), null);
});

test("integrityIndex: бұзушылықсыз — 100, бұзушылық балл азайтады", () => {
  assert.equal(integrityIndex([{ type: "consent" }, { type: "snapshot" }, { type: "camera_on" }]), 100);
  assert.equal(integrityIndex([{ type: "consent" }, { type: "phone_detected" }, { type: "looking_away" }]), 80);
  assert.equal(integrityIndex([{ type: "consent" }, ...Array.from({ length: 10 }, () => ({ type: "multiple_faces" as const }))]), 0);
});

test("integrityIndex: әкімші «қате дабыл» деген оқиға есептелмейді", () => {
  const events = [{ type: "consent" as const }, { type: "phone_detected" as const, dismissed_at: "2026-11-13T10:00:00Z" }, { type: "no_face" as const }];
  assert.equal(integrityIndex(events), 92);
});

test("integrityTone және сертификат шегі", () => {
  assert.equal(integrityTone(95), "good");
  assert.equal(integrityTone(75), "warn");
  assert.equal(integrityTone(40), "bad");
  assert.equal(integrityTone(null), "none");
  assert.ok(CERT_MIN_INTEGRITY >= 70 && CERT_MIN_INTEGRITY <= 90);
});
