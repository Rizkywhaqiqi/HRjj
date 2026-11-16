#!/usr/bin/env node
/**
 * Creates a local .env with cryptographically random development secrets.
 * Refuses to overwrite an existing file so real credentials are never lost.
 * Secret values are written to disk only and are never printed.
 */
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), ".env");

if (existsSync(target)) {
  console.error("[env:init] .env already exists. Delete it manually before regenerating.");
  process.exit(1);
}

const base64Key = () => randomBytes(32).toString("base64");
const base64Secret = () => randomBytes(48).toString("base64");
const adminPassword = `${randomBytes(15)
  .toString("base64")
  .replaceAll("/", "x")
  .replaceAll("+", "y")}Aa1!`;

const encryptionKey = base64Key();
const hmacKey = base64Key();
const authSecret = base64Secret();

if (encryptionKey === hmacKey) {
  console.error("[env:init] Generated duplicate keys; rerun the command.");
  process.exit(1);
}

const content = [
  "# Local development environment. Never commit this file.",
  "DB_HOST=127.0.0.1",
  "DB_PORT=3306",
  "DB_USER=root",
  "DB_PASSWORD=",
  "DB_NAME=jojohrspace",
  "",
  `AUTH_SECRET=${authSecret}`,
  "SESSION_TTL_HOURS=8",
  "",
  `FIELD_ENCRYPTION_KEY=${encryptionKey}`,
  `FIELD_HMAC_KEY=${hmacKey}`,
  "FIELD_KEY_VERSION=1",
  "",
  "SUPER_ADMIN_EMAIL=admin@jojohrspace.local",
  `SUPER_ADMIN_PASSWORD=${adminPassword}`,
  "",
].join("\n");

writeFileSync(target, content, { encoding: "utf8" });

console.info("[env:init] Created .env");
console.info(`[env:init] AUTH_SECRET length: ${authSecret.length}`);
console.info(`[env:init] FIELD_ENCRYPTION_KEY length: ${encryptionKey.length}`);
console.info(`[env:init] FIELD_HMAC_KEY length: ${hmacKey.length}`);
console.info(`[env:init] SUPER_ADMIN_PASSWORD length: ${adminPassword.length}`);
console.info("[env:init] Super Admin email: admin@jojohrspace.local");
console.info("[env:init] Read the generated password from .env and change it after first login.");
