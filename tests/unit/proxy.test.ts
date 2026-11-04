import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrustedProxy } from "@/lib/security/proxy";

const SECRET = "x".repeat(40);
const h = (secret?: string) => new Headers(secret ? { "x-gu-proxy-secret": secret } : {});

test("proxy: secret not configured → never trusted", () => {
  delete process.env.PROXY_SHARED_SECRET;
  assert.equal(isTrustedProxy(h(SECRET)), false);
});

test("proxy: matching secret trusted, wrong or missing rejected", () => {
  process.env.PROXY_SHARED_SECRET = SECRET;
  assert.equal(isTrustedProxy(h(SECRET)), true);
  assert.equal(isTrustedProxy(h("y".repeat(40))), false);
  assert.equal(isTrustedProxy(h(SECRET.slice(1))), false);
  assert.equal(isTrustedProxy(h()), false);
});

test("proxy: short secret is ignored", () => {
  process.env.PROXY_SHARED_SECRET = "short";
  assert.equal(isTrustedProxy(h("short")), false);
  delete process.env.PROXY_SHARED_SECRET;
});
