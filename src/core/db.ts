import {
  createPool,
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { getDbEnv } from "./env";
import { getDbConnectionOptions } from "./db-config";

export type SqlValue =
  string | number | boolean | Date | Buffer | Uint8Array | null;
export type SqlParams = SqlValue[];

let pool: Pool | undefined;

// Keep one pool per warm server/runtime instance. This prevents a new pool
// from being created on every module reload or serverless request.
const globalForDb = globalThis as typeof globalThis & {
  __jojohrspacePool?: Pool;
};

export function getPool(): Pool {
  if (!pool && globalForDb.__jojohrspacePool) {
    pool = globalForDb.__jojohrspacePool;
  }

  if (!pool) {
    const config = getDbEnv();
    pool = createPool({
      ...getDbConnectionOptions(),
      waitForConnections: true,
      // Vercel can create multiple warm instances. Keep each instance small
      // so the combined connection count stays friendly to Aiven's limits.
      connectionLimit: config.DB_CONNECTION_LIMIT,
      maxIdle: Math.min(2, config.DB_CONNECTION_LIMIT),
      idleTimeout: 60_000,
      queueLimit: config.DB_QUEUE_LIMIT,
      charset: "utf8mb4",
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      connectTimeout: 10_000,
    });
    globalForDb.__jojohrspacePool = pool;
  }

  return pool;
}

export async function queryRows<T extends RowDataPacket>(
  sql: string,
  params: SqlParams = [],
): Promise<T[]> {
  const [rows] = await getPool().execute<T[]>(sql, params);
  return rows;
}

export async function executeSql(
  sql: string,
  params: SqlParams = [],
): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "Database transaction failed and rollback could not complete",
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    const currentPool = pool;
    pool = undefined;
    if (globalForDb.__jojohrspacePool === currentPool) {
      globalForDb.__jojohrspacePool = undefined;
    }
    await currentPool.end();
  }
}
