import assert from "node:assert/strict";
import { test } from "node:test";
import { signDeviceToken, verifyDeviceToken } from "@/lib/device/cookie";

const secret = "x".repeat(40);

test("қолтаңбалы құрылғы cookie-і", async () => {
  const token = await signDeviceToken(secret, "user-1", "dev-1");
  const ok = await verifyDeviceToken(secret, token);
  assert.equal(ok?.u, "user-1");
  assert.equal(ok?.expired, false);
});

test("басқа құпия, өзгертілген мазмұн, қоқыс — қабылданбайды", async () => {
  const token = await signDeviceToken(secret, "user-1", "dev-1");
  assert.equal(await verifyDeviceToken("y".repeat(40), token), null);
  const [, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ u: "user-2", d: "dev-1", e: 9999999999 })).toString("base64url");
  assert.equal(await verifyDeviceToken(secret, `${forged}.${signature}`), null);
  assert.equal(await verifyDeviceToken(secret, "abc"), null);
  assert.equal(await verifyDeviceToken(secret, undefined), null);
});
