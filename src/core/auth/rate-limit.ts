import { createHash } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { executeSql, queryRows } from "../db";

export interface RateLimitOptions {
  /** Stable bucket namespace, e.g. `login:ip`. Never put raw PII here. */
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface RateLimitRow extends RowDataPacket {
  counter: number;
}

/**
 * Builds a bucket key from a scope and an identifier. The identifier is hashed
 * so IP addresses and email addresses are not stored in plain text.
 */
export function rateLimitKey(scope: string, identifier: string): string {
  const digest = createHash("sha256")
    .update(identifier.trim().toLowerCase(), "utf8")
    .digest("hex")
    .slice(0, 32);

  return `${scope}:${digest}`;
}

/**
 * DB-backed fixed-window limiter so every application instance shares the same
 * counter. The window start is part of the primary key, which keeps the
 * increment to a single atomic statement on MySQL and MariaDB.
 */
export async function consumeRateLimit(
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % options.windowSeconds);
  const bucketKey = `${options.key}:${windowStart}`;
  const expiresAt = new Date((windowStart + options.windowSeconds * 2) * 1000);

  await executeSql(
    `INSERT INTO rate_limit_buckets (bucket_key, counter, expires_at)
     VALUES (?, 1, ?)
     ON DUPLICATE KEY UPDATE counter = counter + 1`,
    [bucketKey, expiresAt],
  );

  const rows = await queryRows<RateLimitRow>(
    "SELECT counter FROM rate_limit_buckets WHERE bucket_key = ? LIMIT 1",
    [bucketKey],
  );
  const counter = rows[0]?.counter ?? 1;

  // Opportunistic cleanup keeps the table bounded without a separate job.
  if (Math.random() < 0.02) {
    await purgeExpiredRateLimits();
  }

  return {
    allowed: counter <= options.limit,
    remaining: Math.max(0, options.limit - counter),
    retryAfterSeconds: Math.max(
      1,
      windowStart + options.windowSeconds - nowSeconds,
    ),
  };
}

export async function purgeExpiredRateLimits(): Promise<number> {
  try {
    const result = await executeSql(
      "DELETE FROM rate_limit_buckets WHERE expires_at < NOW() LIMIT 500",
    );
    return result.affectedRows;
  } catch (error) {
    console.error(
      "[rate-limit] Failed to purge expired buckets.",
      error instanceof Error ? error.name : "unknown",
    );
    return 0;
  }
}
