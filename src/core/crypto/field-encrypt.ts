import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getSecurityEnv } from "../env";

const ALGORITHM = "aes-256-gcm";
const FORMAT_PREFIX = "enc";
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

interface KeyMaterial {
  activeVersion: number;
  encryptionKeys: Map<number, Buffer>;
  hmacKey: Buffer;
}

let keyMaterial: KeyMaterial | undefined;

function decodeKey(value: string, label: string): Buffer {
  const key = Buffer.from(value, "base64");

  if (key.length !== KEY_LENGTH) {
    throw new Error(`${label} must be a base64-encoded 32-byte key`);
  }

  return key;
}

/**
 * Loads and validates key material once per process. The active key is used for
 * encryption; an optional previous key keeps rotation decrypt-only.
 */
function getKeyMaterial(): KeyMaterial {
  if (keyMaterial) {
    return keyMaterial;
  }

  const env = getSecurityEnv();
  const encryptionKeys = new Map<number, Buffer>([
    [env.FIELD_KEY_VERSION, decodeKey(env.FIELD_ENCRYPTION_KEY, "FIELD_ENCRYPTION_KEY")],
  ]);

  const previousKey = env.FIELD_ENCRYPTION_KEY_PREVIOUS?.trim();
  if (previousKey && env.FIELD_KEY_VERSION_PREVIOUS !== undefined) {
    encryptionKeys.set(
      env.FIELD_KEY_VERSION_PREVIOUS,
      decodeKey(previousKey, "FIELD_ENCRYPTION_KEY_PREVIOUS"),
    );
  }

  keyMaterial = {
    activeVersion: env.FIELD_KEY_VERSION,
    encryptionKeys,
    hmacKey: decodeKey(env.FIELD_HMAC_KEY, "FIELD_HMAC_KEY"),
  };

  return keyMaterial;
}

/**
 * Encrypts a field with AES-256-GCM.
 * Output format: `enc:v<version>:<nonce>:<authTag>:<ciphertext>` (base64url parts).
 */
export function encryptField(plaintext: string): string {
  const { activeVersion, encryptionKeys } = getKeyMaterial();
  const key = encryptionKeys.get(activeVersion);

  if (!key) {
    throw new Error(`Missing encryption key for version ${activeVersion}`);
  }

  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    FORMAT_PREFIX,
    `v${activeVersion}`,
    nonce.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptField(payload: string): string {
  const parts = payload.split(":");

  if (parts.length !== 5 || parts[0] !== FORMAT_PREFIX) {
    throw new Error("Unsupported encrypted field format");
  }

  const [, versionPart, noncePart, authTagPart, ciphertextPart] = parts;
  const version = Number(versionPart.replace(/^v/, ""));

  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Unsupported encrypted field key version");
  }

  const { encryptionKeys } = getKeyMaterial();
  const key = encryptionKeys.get(version);

  if (!key) {
    throw new Error(`No key material available for ciphertext version ${version}`);
  }

  const nonce = Buffer.from(noncePart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");

  if (nonce.length !== NONCE_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted field payload");
  }

  const decipher = createDecipheriv(ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Normalizes identifiers before hashing: keeps digits only so formatting
 * differences (spaces, dots, dashes) do not break duplicate detection.
 */
export function normalizeBlindIndexValue(value: string): string {
  return value.normalize("NFKC").replace(/\D+/g, "");
}

/** HMAC-SHA256 blind index (hex, 64 chars) for equality lookups. */
export function createBlindIndex(value: string): string {
  const { hmacKey } = getKeyMaterial();
  return createHmac("sha256", hmacKey)
    .update(normalizeBlindIndexValue(value), "utf8")
    .digest("hex");
}

export function isEncryptedField(value: string): boolean {
  return value.startsWith(`${FORMAT_PREFIX}:`);
}

export function encryptedFieldVersion(value: string): number | null {
  const parts = value.split(":");
  if (parts.length !== 5 || parts[0] !== FORMAT_PREFIX) return null;
  const version = Number(parts[1].replace(/^v/, ""));
  return Number.isInteger(version) && version >= 1 ? version : null;
}

/** Returns true when a ciphertext should be rewritten with the active key. */
export function needsReencryption(value: string): boolean {
  const version = encryptedFieldVersion(value);
  return version !== null && version !== getKeyMaterial().activeVersion;
}

/** Decrypts with the configured key set and encrypts with the active version. */
export function reencryptField(value: string): string {
  return encryptField(decryptField(value));
}

/** Constant-time string comparison for secrets and tokens. */
export function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
