import {
  createPool,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { getDbEnv } from "../src/core/env";

interface EmployeeCleanupRow extends RowDataPacket {
  id: number;
  employee_code: string;
  full_name: string;
  created_at: string;
}

interface CountRow extends RowDataPacket {
  total: number;
}

function parseArgs(args: string[]) {
  const from = args[args.indexOf("--from") + 1];
  const to = args[args.indexOf("--to") + 1];
  if (!from || !to || from.startsWith("--") || to.startsWith("--")) {
    throw new Error(
      "Usage: tsx scripts/cleanup-import.ts --from EMP-000001 --to EMP-001148 [--purge-staging] [--commit]",
    );
  }
  if (!/^EMP-\d{6}$/.test(from) || !/^EMP-\d{6}$/.test(to) || from > to) {
    throw new Error("Rentang kode harus berbentuk EMP-XXXXXX dan urut.");
  }
  return {
    from,
    to,
    purgeStaging: args.includes("--purge-staging"),
    commit: args.includes("--commit"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = getDbEnv();
  const pool = createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  try {
    const [toDelete] = await pool.query<EmployeeCleanupRow[]>(
      `SELECT id, employee_code, full_name, created_at FROM employees
       WHERE employee_code BETWEEN ? AND ?
       ORDER BY id`,
      [args.from, args.to],
    );
    console.log(`Target ${toDelete.length} karyawan (${args.from} s/d ${args.to}).`);

    if (args.purgeStaging) {
      const [staging] = await pool.query<CountRow[]>(
        "SELECT COUNT(*) AS total FROM employee_import_staging",
      );
      console.log(`Staging yang akan dibersihkan: ${staging[0].total} baris.`);
    }

    if (!args.commit) {
      console.log("Dry-run: tidak ada data yang diubah. Tambahkan --commit untuk menjalankan.");
      console.table(toDelete.slice(0, 10));
      return;
    }

    if (!args.purgeStaging) {
      throw new Error("Pembersihan staging wajib diminta dengan --purge-staging.");
    }

    await pool.query("START TRANSACTION");
    const [checklistResult] = await pool.execute<ResultSetHeader>(
      `DELETE ci FROM checklist_items ci
       INNER JOIN employees e ON e.id = ci.employee_id
       WHERE e.employee_code BETWEEN ? AND ?`,
      [args.from, args.to],
    );
    await pool.execute("DELETE FROM employee_import_staging");
    const [result] = await pool.execute<ResultSetHeader>(
      `DELETE FROM employees WHERE employee_code BETWEEN ? AND ?`,
      [args.from, args.to],
    );
    const nextNumber = Number(args.from.slice(4)) || 1;
    await pool.execute(
      "UPDATE employee_code_sequences SET next_number = ? WHERE id = 1",
      [nextNumber],
    );
    await pool.query("COMMIT");

    console.log(`Berhasil menghapus ${result.affectedRows} baris.`);
    console.log(`Checklist onboarding ikut dihapus: ${checklistResult.affectedRows} baris.`);
    console.log(`Employee code sequence direset ke ${nextNumber}.`);

    const [remaining] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM employees",
    );
    console.log(`Sisa karyawan di database: ${remaining[0].total}`);
  } catch (error) {
    try {
      await pool.query("ROLLBACK");
    } catch {
      // Tidak ada transaksi aktif pada mode dry-run atau bila koneksi sudah gagal.
    }
    throw error;
  } finally {
    await pool.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
