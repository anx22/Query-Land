/**
 * token-crypto.ts — reversible AES-256-GCM encryption for OAuth tokens at rest.
 *
 * OAuth refresh tokens must be decryptable (to mint new access tokens), so we use authenticated
 * symmetric encryption rather than the one-way scrypt hashing in password.ts. The 32-byte key is
 * derived from the OAUTH_ENCRYPTION_KEY env var (any length/passphrase) via scryptSync, so operators
 * can set a human-friendly secret. Each blob carries its own random 12-byte IV and GCM auth tag.
 *
 * Stored format (self-describing, versioned): "v1:gcm:<ivB64>:<tagB64>:<ciphertextB64>".
 *
 * Never log plaintext tokens or the derived key.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const VERSION = "v1";
const ALGO = "gcm";
const CIPHER = "aes-256-gcm";
const KEY_SALT = "seo-tool-oauth-token";
const IV_BYTES = 12;

/** Whether an encryption key is configured. Callers degrade gracefully when false. */
export function oauthEncryptionConfigured(): boolean {
  return typeof process.env.OAUTH_ENCRYPTION_KEY === "string" && process.env.OAUTH_ENCRYPTION_KEY.length > 0;
}

function deriveKey(): Buffer {
  const secret = process.env.OAUTH_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("OAUTH_ENCRYPTION_KEY is not set — cannot encrypt/decrypt OAuth tokens.");
  }
  return scryptSync(secret, KEY_SALT, 32);
}

/** Encrypt any JSON-serialisable value into a versioned, self-describing string. */
export function encryptJson(value: unknown): string {
  const key = deriveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, ALGO, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Decrypt a string produced by {@link encryptJson}. Throws on tampering or a wrong key. */
export function decryptJson<T = unknown>(blob: string): T {
  const parts = blob.split(":");
  if (parts.length !== 5 || parts[0] !== VERSION || parts[1] !== ALGO) {
    throw new Error("Unrecognised encrypted token format.");
  }
  const [, , ivB64, tagB64, ctB64] = parts;
  const key = deriveKey();
  const decipher = createDecipheriv(CIPHER, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
