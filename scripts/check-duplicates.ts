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
    // Total employees
    const [total] = await pool.query<{ total: number }[]>(
      "SELECT COUNT(*) AS total FROM employees"
    );
    console.log(`Total karyawan: ${total[0].total}`);

    // Duplicate full_name + phone
    const [dupNamePhone] = await pool.query<any[]>(
      `SELECT full_name, phone, COUNT(*) AS cnt, GROUP_CONCAT(employee_code SEPARATOR ', ') AS codes
       FROM employees
       GROUP BY full_name, phone
       HAVING cnt > 1
       ORDER BY cnt DESC
       LIMIT 30`
    );
    console.log(`\n=== Duplikat Nama + Telepon (${dupNamePhone.length}) ===`);
    console.table(dupNamePhone);

    // Duplicate full_name only
    const [dupName] = await pool.query<any[]>(
      `SELECT full_name, COUNT(*) AS cnt, GROUP_CONCAT(employee_code SEPARATOR ', ') AS codes
       FROM employees
       GROUP BY full_name
       HAVING cnt > 1
       ORDER BY cnt DESC
       LIMIT 30`
    );
    console.log(`\n=== Duplikat Nama Saja (${dupName.length}) ===`);
    console.table(dupName);

    // Employees imported recently (highest IDs)
    const [recent] = await pool.query<any[]>(
      `SELECT employee_code, full_name, phone, email, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM employees
       ORDER BY id DESC LIMIT 20`
    );
    console.log(`\n=== 20 Karyawan Terbaru (berdasarkan ID) ===`);
    console.table(recent);

    // Check for employees with same join_date pattern from import (2026 dates)
    const [imported2026] = await pool.query<{ cnt: number }[]>(
      `SELECT COUNT(*) AS cnt FROM employees WHERE join_date >= '2026-01-01'`
    );
    console.log(`\nKaryawan dengan join_date >= 2026-01-01: ${imported2026[0].cnt}`);
  } finally {
    await pool.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
