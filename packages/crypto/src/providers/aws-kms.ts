import type { DataKey, KmsProvider } from "./types.js";

/**
 * AWS KMS provider.
 *
 * Pulls `@aws-sdk/client-kms` lazily so the rest of the crypto package
 * (and the local dev path) doesn't have to pay the SDK weight. The peer
 * dependency is declared optional; if the SDK isn't installed when this
 * provider is instantiated, we throw with a clear message.
 *
 * Usage:
 *   const provider = await AwsKmsProvider.create({ region: "ap-southeast-1" });
 *   const dk = await provider.generateDataKey("arn:aws:kms:...:key/...");
 */
export class AwsKmsProvider implements KmsProvider {
  readonly name = "aws-kms";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private constructor(private readonly client: any) {}

  static async create(opts: { region?: string; endpoint?: string } = {}): Promise<AwsKmsProvider> {
    let mod: typeof import("@aws-sdk/client-kms");
    try {
      mod = await import("@aws-sdk/client-kms");
    } catch (err: unknown) {
      throw new Error(
        "AwsKmsProvider requires @aws-sdk/client-kms. Install with: pnpm add @aws-sdk/client-kms",
      );
    }
    const client = new mod.KMSClient({
      ...(opts.region ? { region: opts.region } : {}),
      ...(opts.endpoint ? { endpoint: opts.endpoint } : {}),
    });
    return new AwsKmsProvider(client);
  }

  async generateDataKey(keyId: string): Promise<DataKey> {
    const { GenerateDataKeyCommand } = await import("@aws-sdk/client-kms");
    const res = await this.client.send(
      new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: "AES_256" }),
    );
    if (!res.Plaintext || !res.CiphertextBlob || !res.KeyId) {
      throw new Error("aws kms: GenerateDataKey returned an incomplete response");
    }
    return {
      plaintext: Buffer.from(res.Plaintext),
      ciphertext: Buffer.from(res.CiphertextBlob),
      keyId: res.KeyId,
    };
  }

  async decryptDataKey({ keyId, ciphertext }: { keyId: string; ciphertext: Buffer }): Promise<Buffer> {
    const { DecryptCommand } = await import("@aws-sdk/client-kms");
    const res = await this.client.send(
      new DecryptCommand({ KeyId: keyId, CiphertextBlob: ciphertext }),
    );
    if (!res.Plaintext) throw new Error("aws kms: Decrypt returned no plaintext");
    return Buffer.from(res.Plaintext);
  }
}
