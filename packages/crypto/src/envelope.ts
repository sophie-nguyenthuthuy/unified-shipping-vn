import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { KmsProvider } from "./providers/types.js";

/**
 * Envelope encryption: the secret is encrypted with a fresh per-record Data
 * Encryption Key (DEK); the DEK is wrapped by a Key Encryption Key (KEK)
 * managed by the KMS provider. Only the wrapped DEK + ciphertext are stored.
 *
 * Storage format (`Envelope`):
 *   - keyId           — opaque KEK identifier returned by the provider
 *   - providerName    — provider name; lets us migrate KMS without ambiguity
 *   - wrappedDek      — provider-wrapped DEK ciphertext
 *   - iv              — 12-byte AES-GCM IV
 *   - tag             — 16-byte AES-GCM authentication tag
 *   - ciphertext      — the actual encrypted secret bytes
 *
 * Wire format (`EncryptedBytes`) is a single buffer suitable for `bytea` /
 * `Bytes` columns:
 *
 *   <1 byte version><1 byte keyIdLen><keyId><1 byte providerLen><provider>
 *   <2 bytes wrappedDekLen (BE)><wrappedDek><12 bytes iv><16 bytes tag>
 *   <ciphertext>
 *
 * Version is reserved for forward-compat (e.g. rotating to AES-256-SIV).
 */

const VERSION = 1;

export interface Envelope {
  keyId: string;
  providerName: string;
  wrappedDek: Buffer;
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
}

export type EncryptedBytes = Buffer;

export const encryptSecret = async (
  provider: KmsProvider,
  keyId: string,
  plaintext: Buffer | string,
): Promise<Envelope> => {
  const pt = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const dek = await provider.generateDataKey(keyId);
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dek.plaintext, iv);
    const ciphertext = Buffer.concat([cipher.update(pt), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      keyId: dek.keyId,
      providerName: provider.name,
      wrappedDek: dek.ciphertext,
      iv,
      tag,
      ciphertext,
    };
  } finally {
    // Best-effort scrub. Node's GC may keep a copy, but for an in-memory
    // attacker this strictly reduces the window the DEK is recoverable.
    dek.plaintext.fill(0);
  }
};

export const decryptSecret = async (provider: KmsProvider, env: Envelope): Promise<Buffer> => {
  if (provider.name !== env.providerName) {
    throw new Error(
      `envelope provider mismatch: stored=${env.providerName} resolver=${provider.name}`,
    );
  }
  const dek = await provider.decryptDataKey({ keyId: env.keyId, ciphertext: env.wrappedDek });
  try {
    const decipher = createDecipheriv("aes-256-gcm", dek, env.iv);
    decipher.setAuthTag(env.tag);
    return Buffer.concat([decipher.update(env.ciphertext), decipher.final()]);
  } finally {
    dek.fill(0);
  }
};

export const encodeEnvelope = (env: Envelope): EncryptedBytes => {
  const keyIdBuf = Buffer.from(env.keyId, "utf8");
  const providerBuf = Buffer.from(env.providerName, "utf8");
  if (keyIdBuf.length > 255) throw new Error("keyId too long");
  if (providerBuf.length > 255) throw new Error("providerName too long");
  if (env.wrappedDek.length > 0xff_ff) throw new Error("wrappedDek too long");
  if (env.iv.length !== 12) throw new Error("iv must be 12 bytes");
  if (env.tag.length !== 16) throw new Error("tag must be 16 bytes");

  const wrappedLen = Buffer.alloc(2);
  wrappedLen.writeUInt16BE(env.wrappedDek.length, 0);

  return Buffer.concat([
    Buffer.from([VERSION]),
    Buffer.from([keyIdBuf.length]),
    keyIdBuf,
    Buffer.from([providerBuf.length]),
    providerBuf,
    wrappedLen,
    env.wrappedDek,
    env.iv,
    env.tag,
    env.ciphertext,
  ]);
};

export const decodeEnvelope = (buf: EncryptedBytes): Envelope => {
  let off = 0;
  const version = buf[off++];
  if (version !== VERSION) throw new Error(`unsupported envelope version: ${version}`);

  const keyIdLen = buf[off++]!;
  const keyId = buf.subarray(off, off + keyIdLen).toString("utf8");
  off += keyIdLen;

  const providerLen = buf[off++]!;
  const providerName = buf.subarray(off, off + providerLen).toString("utf8");
  off += providerLen;

  const wrappedLen = buf.readUInt16BE(off);
  off += 2;
  const wrappedDek = buf.subarray(off, off + wrappedLen);
  off += wrappedLen;

  const iv = buf.subarray(off, off + 12);
  off += 12;
  const tag = buf.subarray(off, off + 16);
  off += 16;

  const ciphertext = buf.subarray(off);
  return { keyId, providerName, wrappedDek, iv, tag, ciphertext };
};
