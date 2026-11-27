import type { ConnectionOptions } from "mysql2/promise";
import { getDbEnv } from "./env";

/**
 * Builds the shared MySQL connection options used by the app and migrations.
 * DB_SSL_CA is intentionally supplied through the environment so Vercel does
 * not need a certificate file checked into the repository.
 */
export function getDbConnectionOptions(
  overrides: Partial<ConnectionOptions> = {},
): ConnectionOptions {
  const env = getDbEnv();

  const options: ConnectionOptions = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ...overrides,
  };

  const sslMode =
    process.env.VERCEL && env.DB_SSL_MODE === "disabled"
      ? "required"
      : env.DB_SSL_MODE;
  if (sslMode === "required") {
    options.ssl = { rejectUnauthorized: false };
  } else if (sslMode === "verify-ca") {
    options.ssl = {
      ca: env.DB_SSL_CA,
      rejectUnauthorized: true,
    };
  }

  return options;
}
