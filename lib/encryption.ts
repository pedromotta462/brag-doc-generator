import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc:";

function getKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "";
  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY or NEXTAUTH_SECRET must be set for encryption"
    );
  }
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a string using AES-256-GCM.
 * Output format: "enc:" + base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return PREFIX + combined.toString("base64");
}

/**
 * Decrypts a string. If the value does not start with "enc:", returns as-is (legacy unencrypted).
 */
export function decrypt(value: string | null | undefined): string {
  if (value == null || value === "") return value;
  if (!value.startsWith(PREFIX)) return value; // legacy unencrypted
  try {
    const key = getKey();
    const buf = Buffer.from(value.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    return value; // on failure, return as-is to avoid breaking
  }
}
