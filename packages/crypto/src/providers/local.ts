import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { DataKey, KmsProvider } from "./types.js";

/**
 * Local KMS provider for development and CI.
 *
 * The KEK is a 32-byte key supplied at construction. Data keys are sealed
 * with AES-256-GCM (`<iv|tag|ciphertext>`) so we can verify integrity at
 * unwrap time, identical to what AWS KMS does behind its API.
 *
 * **Never use in production.** The KEK lives in process memory and was
 * almost certainly read from an env var; that gives no protection against
 * a process memory dump or a malicious operator. Switch to a real KMS
 * provider (AwsKmsProvider, etc.) before production.
 */
export class LocalKmsProvider implements KmsProvider {
  readonly name = "local";

  /**
   * Multiple KEKs are supported so callers can simulate rotation. The `keyId`
   * passed to `generateDataKey` selects which KEK to use; only KEKs that
   * exist in the map can produce or consume data keys.
   */
  private readonly keks: Map<string, Buffer>;

  constructor(keks: Record<string, Buffer | string>) {
    if (Object.keys(keks).length === 0) {
      throw new Error("LocalKmsProvider: at least one KEK required");
    }
    this.keks = new Map();
    for (const [id, key] of Object.entries(keks)) {
      const buf = typeof key === "string" ? Buffer.from(key, "base64") : key;
      if (buf.length !== 32) {
        throw new Error(`LocalKmsProvider: KEK ${id} must be 32 bytes (got ${buf.length})`);
      }
      this.keks.set(id, buf);
    }
  }

  async generateDataKey(keyId: string): Promise<DataKey> {
    const kek = this.keks.get(keyId);
    if (!kek) throw new Error(`LocalKmsProvider: unknown keyId ${keyId}`);

    const plaintext = randomBytes(32);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", kek, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Persisted form: <iv (12)><tag (16)><ciphertext>.
    const ciphertext = Buffer.concat([iv, tag, encrypted]);
    return { plaintext, ciphertext, keyId };
  }

  async decryptDataKey({ keyId, ciphertext }: { keyId: string; ciphertext: Buffer }): Promise<Buffer> {
    const kek = this.keks.get(keyId);
    if (!kek) throw new Error(`LocalKmsProvider: unknown keyId ${keyId}`);
    if (ciphertext.length < 12 + 16 + 1) {
      throw new Error("LocalKmsProvider: malformed wrapped data key");
    }
    const iv = ciphertext.subarray(0, 12);
    const tag = ciphertext.subarray(12, 28);
    const body = ciphertext.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  }
}
