/**
 * Pluggable KMS provider contract.
 *
 * The envelope-encryption flow uses a Key Encryption Key (KEK) managed by the
 * provider (AWS KMS, GCP KMS, Vault Transit, …) to wrap a per-record Data
 * Encryption Key (DEK). The DEK never leaves memory in plaintext form on the
 * way in or out of storage; only the wrapped form is persisted.
 *
 *   generateDataKey()  → { plaintext: <32 bytes>, ciphertext: <provider blob> }
 *   decryptDataKey(blob) → plaintext (32 bytes)
 *
 * `keyId` is opaque to callers; some providers (AWS KMS) carry a key ARN,
 * others (Vault Transit) carry a path. We persist whatever the provider
 * returns alongside the wrapped DEK so future decryption knows where to go.
 */

export interface DataKey {
  /** Plaintext key material — caller MUST zero it out after use where feasible. */
  plaintext: Buffer;
  /** Provider-wrapped form to persist alongside the ciphertext. */
  ciphertext: Buffer;
  /** Opaque key identifier; persisted to route future decrypt calls. */
  keyId: string;
}

export interface KmsProvider {
  readonly name: string;

  /** Generate a fresh 256-bit data key wrapped by the KEK named `keyId`. */
  generateDataKey(keyId: string): Promise<DataKey>;

  /** Unwrap a previously generated data key. */
  decryptDataKey(opts: { keyId: string; ciphertext: Buffer }): Promise<Buffer>;
}
