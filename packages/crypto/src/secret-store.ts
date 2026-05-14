import {
  decodeEnvelope,
  decryptSecret,
  encodeEnvelope,
  encryptSecret,
  type EncryptedBytes,
} from "./envelope.js";
import type { KmsProvider } from "./providers/types.js";

/**
 * High-level wrapper used by API handlers and workers.
 *
 *   const store = createSecretStore(provider, { defaultKeyId: "primary" });
 *   const blob  = await store.sealJson({ token: "abc" });
 *   const obj   = await store.openJson(blob);
 *
 * Apps don't talk to the KMS provider directly — they hold a `SecretStore`
 * and operate on `EncryptedBytes` blobs that go straight into `bytea` columns.
 */
export interface SecretStore {
  /** Encrypt a JSON-serializable object; returns bytes ready for storage. */
  sealJson(value: unknown, opts?: { keyId?: string }): Promise<EncryptedBytes>;
  /** Decrypt and JSON-parse a stored blob. */
  openJson<T = unknown>(blob: EncryptedBytes): Promise<T>;
  /** Lower-level: encrypt arbitrary bytes/string. */
  seal(plaintext: Buffer | string, opts?: { keyId?: string }): Promise<EncryptedBytes>;
  /** Lower-level: decrypt to bytes. */
  open(blob: EncryptedBytes): Promise<Buffer>;
}

export const createSecretStore = (
  provider: KmsProvider,
  opts: { defaultKeyId: string },
): SecretStore => ({
  seal: async (plaintext, options) => {
    const keyId = options?.keyId ?? opts.defaultKeyId;
    const env = await encryptSecret(provider, keyId, plaintext);
    return encodeEnvelope(env);
  },
  open: async (blob) => {
    const env = decodeEnvelope(blob);
    return decryptSecret(provider, env);
  },
  sealJson: async (value, options) => {
    const keyId = options?.keyId ?? opts.defaultKeyId;
    const env = await encryptSecret(provider, keyId, JSON.stringify(value));
    return encodeEnvelope(env);
  },
  openJson: async <T>(blob: EncryptedBytes) => {
    const env = decodeEnvelope(blob);
    const buf = await decryptSecret(provider, env);
    return JSON.parse(buf.toString("utf8")) as T;
  },
});
