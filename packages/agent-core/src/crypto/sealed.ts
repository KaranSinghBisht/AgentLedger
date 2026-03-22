import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

/** Generate a random 256-bit key as hex string. */
export function generateSealedKey(): string {
  return randomBytes(32).toString("hex");
}

function assertValidKey(keyHex: string): void {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("keyHex must be exactly 64 hex characters (256 bits)");
  }
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns base64(IV + ciphertext + authTag) — a single string safe for JSON/Filecoin.
 */
export function sealContent(plaintext: string, keyHex: string): string {
  assertValidKey(keyHex);
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // IV (12) + ciphertext (variable) + authTag (16)
  const sealed = Buffer.concat([iv, encrypted, tag]);
  return sealed.toString("base64");
}

/**
 * Decrypt a sealed payload (base64) with AES-256-GCM.
 * Throws on wrong key or tampered data.
 */
export function unsealContent(sealed: string, keyHex: string): string {
  assertValidKey(keyHex);
  const key = Buffer.from(keyHex, "hex");
  const buf = Buffer.from(sealed, "base64");

  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("Sealed payload too short to contain IV + auth tag");
  }

  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
