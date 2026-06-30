import assert from "node:assert/strict";
import test from "node:test";
import { decryptJson, encryptJson, oauthEncryptionConfigured } from "../src/oauth/token-crypto.js";

const KEY = "test-oauth-encryption-key-please-rotate";

function withKey<T>(key: string | undefined, fn: () => T): T {
  const prev = process.env.OAUTH_ENCRYPTION_KEY;
  if (key === undefined) delete process.env.OAUTH_ENCRYPTION_KEY;
  else process.env.OAUTH_ENCRYPTION_KEY = key;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.OAUTH_ENCRYPTION_KEY;
    else process.env.OAUTH_ENCRYPTION_KEY = prev;
  }
}

test("encryptJson/decryptJson round-trips a value", () => {
  withKey(KEY, () => {
    const secret = { accessToken: "ya29.aaa", refreshToken: "1//bbb", expiresAt: "2026-06-26T10:00:00.000Z", property: "sc-domain:example.com" };
    const blob = encryptJson(secret);
    assert.ok(blob.startsWith("v1:gcm:"), "blob is versioned");
    assert.ok(!blob.includes("ya29.aaa"), "ciphertext does not leak plaintext");
    assert.deepEqual(decryptJson(blob), secret);
  });
});

test("decryptJson rejects a tampered ciphertext", () => {
  withKey(KEY, () => {
    const blob = encryptJson({ a: 1 });
    const parts = blob.split(":");
    const ct = Buffer.from(parts[4], "base64");
    ct[0] = ct[0] ^ 0xff; // flip a byte
    parts[4] = ct.toString("base64");
    assert.throws(() => decryptJson(parts.join(":")));
  });
});

test("decryptJson fails with the wrong key", () => {
  const blob = withKey(KEY, () => encryptJson({ token: "secret" }));
  withKey("a-completely-different-key", () => {
    assert.throws(() => decryptJson(blob));
  });
});

test("oauthEncryptionConfigured reflects the env var", () => {
  withKey(undefined, () => assert.equal(oauthEncryptionConfigured(), false));
  withKey(KEY, () => assert.equal(oauthEncryptionConfigured(), true));
});
