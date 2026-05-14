import { createSecretStore, resolveProviderFromEnv, type SecretStore } from "@usv/crypto";

/**
 * Process-singleton SecretStore. The KMS client (and its credential chain)
 * are expensive to set up; we initialise once on first access and reuse.
 *
 * The defaultKeyId is the KEK identifier new secrets get sealed with.
 * Existing secrets carry their own keyId in their envelope, so rotation
 * works by changing this default — old secrets still decrypt against the
 * old keyId until they're re-sealed.
 */
let _instance: Promise<SecretStore> | null = null;

export const getSecretStore = (): Promise<SecretStore> => {
  if (!_instance) {
    _instance = (async () => {
      const provider = await resolveProviderFromEnv();
      const defaultKeyId = process.env.USV_KMS_DEFAULT_KEY_ID;
      if (!defaultKeyId) {
        throw new Error(
          "USV_KMS_DEFAULT_KEY_ID is required (the KEK identifier for sealing new secrets)",
        );
      }
      return createSecretStore(provider, { defaultKeyId });
    })();
  }
  return _instance;
};
