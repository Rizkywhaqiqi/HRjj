import { createPool } from "mysql2/promise";
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
    // Count employees with code >= EMP-001149
    const [from1149] = await pool.query<{ cnt: number }[]>(
      "SELECT COUNT(*) AS cnt FROM employees WHERE employee_code >= 'EMP-001149'"
    );
    console.log(`Employees with code >= EMP-001149: ${from1149[0].cnt}`);

    // Check their timestamps
    const [tsCheck] = await pool.query<{ created_at: string; cnt: number }[]>(
      `SELECT created_at, COUNT(*) as cnt FROM employees
       WHERE employee_code >= 'EMP-001149'
       GROUP BY created_at`
    );
    console.log("\nTimestamp distribution for code >= EMP-001149:");
    console.table(tsCheck);

    // Check if any pre-existing employees have codes >= EMP-001149
    const [preExisting] = await pool.query<{ employee_code: string; full_name: string; created_at: string }[]>(
      `SELECT employee_code, full_name, created_at FROM employees
       WHERE employee_code >= 'EMP-001149'
       AND created_at < '2026-11-16 05:00:00'
       ORDER BY employee_code
       LIMIT 10`
    );
    console.log(`\nPre-existing employees with code >= EMP-001149: ${preExisting.length}`);
    if (preExisting.length > 0) console.table(preExisting);

    // Check max code below EMP-001149
    const [maxBelow] = await pool.query<{ maxCode: string }[]>(
      "SELECT MAX(employee_code) AS maxCode FROM employees WHERE employee_code < 'EMP-001149'"
    );
    console.log(`\nMax code below EMP-001149: ${maxBelow[0].maxCode}`);

    // Total
    const [total] = await pool.query<{ total: number }[]>(
      "SELECT COUNT(*) AS total FROM employees"
    );
    console.log(`\nTotal karyawan saat ini: ${total[0].total}`);
    console.log(`Setelah hapus code >= EMP-001149: ${total[0].total - from1149[0].cnt}`);
  } finally {
    await pool.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
