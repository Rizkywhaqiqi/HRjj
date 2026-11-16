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
    // Check employee code sequence
    const [seq] = await pool.query<{ next_number: number }[]>(
      "SELECT next_number FROM employee_code_sequences WHERE id = 1"
    );
    console.log(`Employee code sequence next_number: ${seq[0].next_number}`);

    // Check max employee_code
    const [maxCode] = await pool.query<{ maxCode: string }[]>(
      "SELECT MAX(employee_code) AS maxCode FROM employees"
    );
    console.log(`Max employee_code: ${maxCode[0].maxCode}`);

    // Count employees with code >= EMP-001400
    const [highCodes] = await pool.query<{ cnt: number }[]>(
      "SELECT COUNT(*) AS cnt FROM employees WHERE employee_code >= 'EMP-001400'"
    );
    console.log(`Employees with code >= EMP-001400: ${highCodes[0].cnt}`);

    // Count employees with code >= EMP-001500
    const [veryHigh] = await pool.query<{ cnt: number }[]>(
      "SELECT COUNT(*) AS cnt FROM employees WHERE employee_code >= 'EMP-001500'"
    );
    console.log(`Employees with code >= EMP-001500: ${veryHigh[0].cnt}`);

    // Check what codes exist in 1400-1600 range
    const [codes] = await pool.query<{ employee_code: string; full_name: string; created_at: string }[]>(
      `SELECT employee_code, full_name, created_at FROM employees
       WHERE employee_code >= 'EMP-001400' AND employee_code < 'EMP-001600'
       ORDER BY employee_code`
    );
    console.log(`\nEmployees with code EMP-001400 to EMP-001599: ${codes.length}`);
    console.table(codes.slice(0, 20));
    console.log("...");
    console.table(codes.slice(-20));

    // Total count
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
