import type { PoolConnection, RowDataPacket } from "mysql2/promise";

/** Caller must lock the employee row first, including when no contracts exist yet. */
export async function assertNoContractOverlap(
  connection: PoolConnection,
  employeeId: number,
  start: string,
  end: string | null,
  excludeId = 0,
): Promise<void> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT id FROM contracts WHERE employee_id=? AND status IN ('RUNNING','EXTENDED','MADE_PERMANENT') AND id<>? AND start_date<=COALESCE(?, '9999-12-31') AND (end_date IS NULL OR end_date>=?) LIMIT 1 FOR UPDATE`,
    [employeeId, excludeId, end, start],
  );
  if (rows.length)
    throw new Error("Kontrak aktif karyawan masih tumpang tindih.");
}
