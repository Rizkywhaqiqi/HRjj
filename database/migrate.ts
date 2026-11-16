import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createConnection,
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";
import { getDbConnectionOptions } from "../src/core/db-config";

const projectRoot = process.cwd();
const migrationsDirectory = path.join(projectRoot, "database", "migrations");
const SOURCE_DIRECTIVE = /^[ \t]*SOURCE[ \t]+(.+?);[ \t]*$/gim;
// Keep this aligned with the latest numbered migration represented in schema.sql.
const SCHEMA_SNAPSHOT_VERSION = "0010_notification_claim.sql";

interface MigrationFile {
  version: string;
  checksum: string;
  statements: string[];
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Reads a migration file and expands `SOURCE <path>;` directives (a MySQL CLI
 * command that the server itself does not understand). Each returned chunk may
 * still contain several statements and is executed with multipleStatements
 * enabled.
 */
async function loadMigrationStatements(filePath: string): Promise<string[]> {
  const raw = await readFile(filePath, "utf8");
  const chunks: string[] = [];
  let cursor = 0;

  for (const match of raw.matchAll(SOURCE_DIRECTIVE)) {
    const before = raw.slice(cursor, match.index);
    if (before.trim()) {
      chunks.push(before);
    }

    const relativeTarget = match[1].trim().replace(/^['"]|['"]$/g, "");
    const resolvedTarget = path.resolve(projectRoot, relativeTarget);

    if (!resolvedTarget.startsWith(projectRoot + path.sep)) {
      throw new Error(
        `Refusing to resolve SOURCE outside the project: ${relativeTarget}`,
      );
    }

    chunks.push(await readFile(resolvedTarget, "utf8"));
    cursor = (match.index ?? 0) + match[0].length;
  }

  const tail = raw.slice(cursor);
  if (tail.trim()) {
    chunks.push(tail);
  }

  return chunks;
}

async function readMigrations(): Promise<MigrationFile[]> {
  const entries = await readdir(migrationsDirectory);
  const versions = entries.filter((entry) => entry.endsWith(".sql")).sort();

  const migrations: MigrationFile[] = [];
  for (const version of versions) {
    const filePath = path.join(migrationsDirectory, version);
    // The checksum covers the migration file itself. Files that use SOURCE to
    // load the canonical snapshot should not change checksum when the snapshot
    // gains a new table that is already handled by its own numbered migration.
    const source = await readFile(filePath, "utf8");
    const statements = await loadMigrationStatements(filePath);

    migrations.push({
      version,
      checksum: sha256(source),
      statements,
    });
  }

  return migrations;
}

async function ensureDatabase(): Promise<void> {
  const connectionOptions = getDbConnectionOptions();
  const bootstrapOptions = { ...connectionOptions, database: undefined };
  const bootstrap = await createConnection(bootstrapOptions);

  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${connectionOptions.database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await bootstrap.end();
  }
}

async function applyMigration(
  connection: Connection,
  migration: MigrationFile,
): Promise<void> {
  for (const chunk of migration.statements) {
    await connection.query(chunk);
  }
}

async function runMigrations(): Promise<void> {
  await ensureDatabase();

  const connection = await createConnection({
    ...getDbConnectionOptions(),
    charset: "utf8mb4",
    multipleStatements: true,
  });

  try {
    const [tableRows] = await connection.query<
      Array<RowDataPacket & { table_count: number }>
    >(
      `SELECT COUNT(*) AS table_count
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`,
    );
    const databaseWasEmpty = Number(tableRows[0]?.table_count ?? 0) === 0;

    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(120) NOT NULL PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const [appliedRows] = await connection.query<
      Array<RowDataPacket & { version: string; checksum: string }>
    >("SELECT version, checksum FROM schema_migrations");

    const applied = new Map(
      appliedRows.map((row) => [row.version, row.checksum]),
    );
    const migrations = await readMigrations();
    let appliedCount = 0;
    let migrationsToProcess = migrations;

    if (databaseWasEmpty) {
      const snapshotIndex = migrations.findIndex(
        (migration) => migration.version === SCHEMA_SNAPSHOT_VERSION,
      );
      const initialMigration = migrations[0];

      if (
        applied.size !== 0 ||
        !initialMigration ||
        initialMigration.version !== "0001_initial.sql" ||
        snapshotIndex < 0
      ) {
        throw new Error("The fresh-database schema snapshot is incomplete.");
      }

      console.info(`[migrate] Bootstrapping schema snapshot through ${SCHEMA_SNAPSHOT_VERSION}...`);
      await applyMigration(connection, initialMigration);

      for (const migration of migrations.slice(0, snapshotIndex + 1)) {
        await connection.execute(
          "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
          [migration.version, migration.checksum],
        );
        applied.set(migration.version, migration.checksum);
        appliedCount += 1;
      }

      migrationsToProcess = migrations.slice(snapshotIndex + 1);
    } else if (applied.size === 0) {
      throw new Error(
        "The database already contains tables but has no migration history; refusing to guess its schema version.",
      );
    }

    for (const migration of migrationsToProcess) {
      const previousChecksum = applied.get(migration.version);

      if (previousChecksum !== undefined) {
        if (previousChecksum !== migration.checksum) {
          console.warn(
            `[migrate] ${migration.version} was applied earlier but its file changed. ` +
              "Create a new numbered migration instead of editing applied history.",
          );
        }
        continue;
      }

      console.info(`[migrate] Applying ${migration.version}...`);
      await applyMigration(connection, migration);
      await connection.execute(
        "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
        [migration.version, migration.checksum],
      );
      appliedCount += 1;
    }

    console.info(
      appliedCount === 0
        ? "[migrate] Database is up to date."
        : `[migrate] Applied ${appliedCount} migration(s).`,
    );
  } finally {
    await connection.end();
  }
}

void runMigrations().catch((error: unknown) => {
  console.error("[migrate] Migration failed.", error);
  process.exitCode = 1;
});
