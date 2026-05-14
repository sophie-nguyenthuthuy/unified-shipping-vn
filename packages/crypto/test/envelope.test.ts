import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createSecretStore,
  decodeEnvelope,
  decryptSecret,
  encodeEnvelope,
  encryptSecret,
  LocalKmsProvider,
} from "../src/index.js";

const buildProvider = () =>
  new LocalKmsProvider({
    primary: randomBytes(32),
    secondary: randomBytes(32),
  });

describe("envelope encryption", () => {
  it("round-trips a payload through the local provider", async () => {
    const provider = buildProvider();
    const env = await encryptSecret(provider, "primary", "hunter2");
    const pt = await decryptSecret(provider, env);
    expect(pt.toString("utf8")).toBe("hunter2");
  });

  it("uses a fresh DEK on every call (different ciphertext for same plaintext)", async () => {
    const provider = buildProvider();
    const a = await encryptSecret(provider, "primary", "same");
    const b = await encryptSecret(provider, "primary", "same");
    expect(Buffer.compare(a.ciphertext, b.ciphertext)).not.toBe(0);
    expect(Buffer.compare(a.wrappedDek, b.wrappedDek)).not.toBe(0);
    expect(Buffer.compare(a.iv, b.iv)).not.toBe(0);
  });

  it("encodes and decodes the wire format losslessly", async () => {
    const provider = buildProvider();
    const env = await encryptSecret(provider, "primary", "payload");
    const wire = encodeEnvelope(env);
    const back = decodeEnvelope(wire);
    expect(back.keyId).toBe(env.keyId);
    expect(back.providerName).toBe(env.providerName);
    expect(Buffer.compare(back.wrappedDek, env.wrappedDek)).toBe(0);
    expect(Buffer.compare(back.iv, env.iv)).toBe(0);
    expect(Buffer.compare(back.tag, env.tag)).toBe(0);
    expect(Buffer.compare(back.ciphertext, env.ciphertext)).toBe(0);
  });

  it("rejects tampered ciphertext (AEAD auth tag check)", async () => {
    const provider = buildProvider();
    const env = await encryptSecret(provider, "primary", "abc");
    const tampered = { ...env, ciphertext: Buffer.concat([env.ciphertext, Buffer.from("X")]) };
    await expect(decryptSecret(provider, tampered)).rejects.toThrow();
  });

  it("supports multiple KEKs (rotation surface)", async () => {
    const provider = buildProvider();
    const a = await encryptSecret(provider, "primary", "v1");
    const b = await encryptSecret(provider, "secondary", "v2");
    expect((await decryptSecret(provider, a)).toString("utf8")).toBe("v1");
    expect((await decryptSecret(provider, b)).toString("utf8")).toBe("v2");
  });

  it("refuses to decrypt envelopes from a different provider", async () => {
    const provider = buildProvider();
    const env = await encryptSecret(provider, "primary", "hi");
    const wrong = { ...env, providerName: "aws-kms" };
    await expect(decryptSecret(provider, wrong)).rejects.toThrow(/provider mismatch/);
  });
});

describe("SecretStore", () => {
  it("seals and opens JSON objects", async () => {
    const store = createSecretStore(buildProvider(), { defaultKeyId: "primary" });
    const blob = await store.sealJson({ token: "ghn-secret", shopId: 42 });
    const back = await store.openJson<{ token: string; shopId: number }>(blob);
    expect(back).toEqual({ token: "ghn-secret", shopId: 42 });
  });

  it("respects per-call key overrides", async () => {
    const store = createSecretStore(buildProvider(), { defaultKeyId: "primary" });
    const blob = await store.seal("data", { keyId: "secondary" });
    const env = decodeEnvelope(blob);
    expect(env.keyId).toBe("secondary");
  });
});
