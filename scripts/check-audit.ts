import { createPool, type RowDataPacket } from "mysql2/promise";
import { getDbEnv } from "../src/core/env";

async function main() {
  const env = getDbEnv();
  const pool = createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  try {
    // Check audit logs for employee.create actions during import time
    const [audit] = await pool.query<RowDataPacket[]>(
      `SELECT id, action, entity_id, details, created_at
       FROM audit_logs
       WHERE action = 'employee.create'
       AND created_at >= '2026-11-16 05:00:00' AND created_at < '2026-11-16 06:00:00'
       ORDER BY id`
    );
    console.log(`Audit log employee.create entries during import: ${audit.length}`);
    console.table(audit.slice(0, 10));

    // Check all audit logs around import time
    const [allAudit] = await pool.query<RowDataPacket[]>(
      `SELECT id, action, entity_type, entity_id, created_at
       FROM audit_logs
       WHERE created_at >= '2026-11-16 05:00:00' AND created_at < '2026-11-16 06:00:00'
       ORDER BY id`
    );
    console.log(`\nAll audit log entries during import window: ${allAudit.length}`);
    console.table(allAudit);

    // Check employees with codes in import range
    const [rangeEmps] = await pool.query<Array<RowDataPacket & { id: number; employee_code: string; full_name: string; created_at: string }>>(
      `SELECT id, employee_code, full_name, created_at FROM employees
       WHERE employee_code >= 'EMP-001100'
       ORDER BY employee_code`
    );
    console.log(`\nEmployees with code >= EMP-001100: ${rangeEmps.length}`);
    
    // Group by timestamp
    const tsGroups: Record<string, number> = {};
    for (const e of rangeEmps) {
      const ts = e.created_at;
      tsGroups[ts] = (tsGroups[ts] || 0) + 1;
    }
    console.log("\nTimestamp groups:");
    console.table(Object.entries(tsGroups).map(([ts, cnt]) => ({ timestamp: ts, count: cnt })));

    // Total count
    const [total] = await pool.query<Array<RowDataPacket & { total: number }>>(
      "SELECT COUNT(*) AS total FROM employees"
    );
    console.log(`\nTotal karyawan saat ini: ${total[0].total}`);
  } finally {
    await pool.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
