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
    // Cek timestamp karyawan terbaru
    const [recent] = await pool.query<{ id: number; employee_code: string; full_name: string; created_at: string }[]>(
      `SELECT id, employee_code, full_name, created_at FROM employees
       ORDER BY id DESC LIMIT 50`
    );
    console.log("=== 50 Karyawan Terbaru ===");
    console.table(recent);

    // Cek distinct timestamps near the top
    const [timestamps] = await pool.query<{ created_at: string; cnt: number }[]>(
      `SELECT created_at, COUNT(*) as cnt FROM employees
       WHERE id > 1300
       GROUP BY created_at
       ORDER BY created_at DESC
       LIMIT 20`
    );
    console.log("\n=== Distinct timestamps (id > 1300) ===");
    console.table(timestamps);

    // Check total count
    const [total] = await pool.query<{ total: number }[]>(
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
