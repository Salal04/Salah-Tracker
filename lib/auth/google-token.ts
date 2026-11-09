import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const algorithm = "aes-256-gcm";

function getKey() {
  const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("Google token encryption key is not configured.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Google token encryption key must decode to 32 bytes.");
  return key;
}

export function encryptGoogleRefreshToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptGoogleRefreshToken(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Stored Google credential is invalid.");
  const decipher = createDecipheriv(algorithm, getKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
