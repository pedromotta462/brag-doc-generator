import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

export type DecryptedAzureConfig = Awaited<
  ReturnType<typeof getDecryptedConfig>
>;

/**
 * Fetches Azure config for a user and returns it with decrypted pat and aiApiKey.
 */
export async function getDecryptedConfig(userId: string) {
  const config = await prisma.azureConfig.findUnique({
    where: { userId },
  });
  if (!config) return null;
  return {
    ...config,
    pat: decrypt(config.pat),
    aiApiKey: config.aiApiKey ? decrypt(config.aiApiKey) : null,
  };
}
