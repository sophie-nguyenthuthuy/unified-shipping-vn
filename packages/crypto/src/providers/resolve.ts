import { LocalKmsProvider } from "./local.js";
import type { KmsProvider } from "./types.js";

/**
 * Pick a KMS provider based on environment.
 *
 *   USV_KMS_PROVIDER=local         → LocalKmsProvider seeded from USV_KMS_LOCAL_KEK_*
 *   USV_KMS_PROVIDER=aws-kms       → AwsKmsProvider (lazy-imported)
 *
 * The `local` provider expects one or more env vars named
 * `USV_KMS_LOCAL_KEK_<NAME>` containing base64-encoded 32-byte keys. The
 * `<NAME>` portion becomes the keyId. At least one is required.
 *
 * In production, always use a real KMS. The local provider exists only so
 * developers and CI can exercise the envelope-encryption code paths without
 * external dependencies.
 */
export const resolveProviderFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<KmsProvider> => {
  const name = (env.USV_KMS_PROVIDER ?? "local").toLowerCase();

  if (name === "local") {
    const keks: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (k.startsWith("USV_KMS_LOCAL_KEK_") && typeof v === "string" && v.length > 0) {
        keks[k.replace("USV_KMS_LOCAL_KEK_", "").toLowerCase()] = v;
      }
    }
    if (Object.keys(keks).length === 0) {
      throw new Error(
        "USV_KMS_PROVIDER=local requires at least one USV_KMS_LOCAL_KEK_<name>=<base64-32-bytes>",
      );
    }
    return new LocalKmsProvider(keks);
  }

  if (name === "aws-kms") {
    const { AwsKmsProvider } = await import("./aws-kms.js");
    return AwsKmsProvider.create({
      ...(env.AWS_REGION ? { region: env.AWS_REGION } : {}),
      ...(env.USV_KMS_AWS_ENDPOINT ? { endpoint: env.USV_KMS_AWS_ENDPOINT } : {}),
    });
  }

  throw new Error(`unknown USV_KMS_PROVIDER: ${name}`);
};
