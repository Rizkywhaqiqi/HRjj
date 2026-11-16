import {
  createPool,
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { getDbConnectionOptions } from "./db-config";

export type SqlValue = string | number | boolean | Date | Buffer | Uint8Array | null;
export type SqlParams = SqlValue[];

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = createPool({
      ...getDbConnectionOptions(),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
    });
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
    await currentPool.end();
  }
}
