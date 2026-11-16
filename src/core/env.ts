import { z } from "zod";

const dbSchema = z.object({
  DB_HOST: z.string().trim().min(1).default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default("root"),
  DB_PASSWORD: z.string().default(""),
  DB_NAME: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/, "DB_NAME may contain only letters, numbers, and underscores")
    .default("jojohrspace"),
  DB_SSL_MODE: z.enum(["disabled", "required", "verify-ca"]).default("disabled"),
  DB_SSL_CA: z.string().optional(),
}).superRefine((value, context) => {
  if (value.DB_SSL_MODE === "verify-ca" && !value.DB_SSL_CA?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DB_SSL_CA"],
      message: "DB_SSL_CA is required when DB_SSL_MODE is verify-ca",
    });
  }
});

const securitySchema = z.object({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(8),
  FIELD_ENCRYPTION_KEY: z.string().min(1, "FIELD_ENCRYPTION_KEY is required"),
  FIELD_HMAC_KEY: z.string().min(1, "FIELD_HMAC_KEY is required"),
  FIELD_KEY_VERSION: z.coerce.number().int().min(1).max(1000).default(1),
  FIELD_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
  FIELD_KEY_VERSION_PREVIOUS: z.coerce.number().int().min(1).max(1000).optional(),
});

export type DbEnv = z.infer<typeof dbSchema>;
export type SecurityEnv = z.infer<typeof securitySchema>;
export type AppEnv = DbEnv & SecurityEnv;

let cachedDb: DbEnv | undefined;
let cachedSecurity: SecurityEnv | undefined;

function parseEnv<T extends z.ZodType>(schema: T, label: string): z.infer<T> {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new Error(`Invalid ${label} environment variables: ${details.join("; ")}`);
  }

  return result.data;
}

/** Decodes a base64 key and enforces the required 32-byte length. */
function decodeKey(value: string, label: string): Buffer {
  const key = Buffer.from(value, "base64");

  if (key.length !== 32) {
    throw new Error(`${label} must be a base64-encoded 32-byte key`);
  }

  return key;
}

/** Database settings only: used by migrations and the seeder. */
export function getDbEnv(): DbEnv {
  cachedDb ??= parseEnv(dbSchema, "database");
  return cachedDb;
}

/** Session and field-encryption settings: validated once per process. */
export function getSecurityEnv(): SecurityEnv {
  if (cachedSecurity) {
    return cachedSecurity;
  }

  const parsed = parseEnv(securitySchema, "security");

  const encryptionKey = decodeKey(parsed.FIELD_ENCRYPTION_KEY, "FIELD_ENCRYPTION_KEY");
  const hmacKey = decodeKey(parsed.FIELD_HMAC_KEY, "FIELD_HMAC_KEY");

  if (encryptionKey.equals(hmacKey)) {
    throw new Error("FIELD_ENCRYPTION_KEY and FIELD_HMAC_KEY must be different keys");
  }

  const previousKey = parsed.FIELD_ENCRYPTION_KEY_PREVIOUS?.trim();

  if (previousKey) {
    decodeKey(previousKey, "FIELD_ENCRYPTION_KEY_PREVIOUS");

    if (parsed.FIELD_KEY_VERSION_PREVIOUS === undefined) {
      throw new Error(
        "FIELD_KEY_VERSION_PREVIOUS is required when FIELD_ENCRYPTION_KEY_PREVIOUS is set",
      );
    }

    if (parsed.FIELD_KEY_VERSION_PREVIOUS >= parsed.FIELD_KEY_VERSION) {
      throw new Error("FIELD_KEY_VERSION_PREVIOUS must be lower than FIELD_KEY_VERSION");
    }
  } else if (parsed.FIELD_KEY_VERSION_PREVIOUS !== undefined) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY_PREVIOUS is required when FIELD_KEY_VERSION_PREVIOUS is set",
    );
  }

  cachedSecurity = parsed;
  return cachedSecurity;
}

export function getAppEnv(): AppEnv {
  return { ...getDbEnv(), ...getSecurityEnv() };
}

