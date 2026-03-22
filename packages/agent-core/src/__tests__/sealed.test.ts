import { describe, it, expect } from "vitest";
import { generateSealedKey, sealContent, unsealContent } from "../crypto/sealed.js";

describe("Sealed Deliverables (AES-256-GCM)", () => {
  it("generates a 64-char hex key", () => {
    const key = generateSealedKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("encrypts and decrypts roundtrip", () => {
    const key = generateSealedKey();
    const plaintext = "This is a confidential deliverable for AgentLedger job #42.";
    const sealed = sealContent(plaintext, key);
    expect(sealed).not.toBe(plaintext);
    expect(sealed.length).toBeGreaterThan(0);
    const decrypted = unsealContent(sealed, key);
    expect(decrypted).toBe(plaintext);
  });

  it("different keys produce different ciphertext", () => {
    const key1 = generateSealedKey();
    const key2 = generateSealedKey();
    const plaintext = "Same content, different keys.";
    const sealed1 = sealContent(plaintext, key1);
    const sealed2 = sealContent(plaintext, key2);
    expect(sealed1).not.toBe(sealed2);
  });

  it("wrong key fails to decrypt", () => {
    const key1 = generateSealedKey();
    const key2 = generateSealedKey();
    const sealed = sealContent("Secret data", key1);
    expect(() => unsealContent(sealed, key2)).toThrow();
  });

  it("rejects invalid key format", () => {
    expect(() => sealContent("test", "not-a-hex-key")).toThrow();
    expect(() => sealContent("test", "abcd")).toThrow();
  });

  it("handles large content", () => {
    const key = generateSealedKey();
    const large = "A".repeat(50000);
    const sealed = sealContent(large, key);
    const decrypted = unsealContent(sealed, key);
    expect(decrypted).toBe(large);
  });
});
