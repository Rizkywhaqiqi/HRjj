// Backward-compatible schema rollout, only after a successful production build.
// Preview builds must never write to the shared production database.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { getDbConnectionOptions } from "../src/core/db-config";
async function main() {
  if (
    process.env.VERCEL_ENV !== "production" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "main"
  ) {
    console.info("[finance-schema] Skipped outside production main.");
    return;
  }
  const conn = await createConnection({
    ...getDbConnectionOptions(),
    multipleStatements: true,
  });
  const version = "0018_finance_foundation.sql";
  try {
    const [locks] = await conn.execute<RowDataPacket[]>(
      "SELECT GET_LOCK(?,30) acquired",
      ["hrjj-finance-schema"],
    );
    if (Number(locks[0]?.acquired) !== 1)
      throw new Error("Schema migration lock unavailable");
    const [rows] = await conn.execute<RowDataPacket[]>(
      "SELECT checksum FROM schema_migrations WHERE version=?",
      [version],
    );
    const sql = await readFile(`database/migrations/${version}`, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (rows.length) {
      if (rows[0].checksum !== checksum)
        throw new Error("Finance migration checksum mismatch");
      console.info("[finance-schema] Already applied.");
      return;
    }
    // Do not run older pending migrations or seeds against an existing production DB.
    await conn.query(sql);
    await conn.execute(
      "INSERT INTO schema_migrations(version,checksum) VALUES (?,?)",
      [version, checksum],
    );
    console.info("[finance-schema] Additive migration applied.");
  } finally {
    await conn
      .execute("SELECT RELEASE_LOCK(?)", ["hrjj-finance-schema"])
      .catch(() => {});
    await conn.end();
  }
}
main().catch(() => {
  console.error(
    "[finance-schema] Migration failed; deployment stopped. Check database schema/connection.",
  );
  process.exitCode = 1;
});
