import "dotenv/config";
import { closePool, queryRows, withTransaction } from "@/core/db";
import { needsReencryption, reencryptField } from "@/core/crypto/field-encrypt";
import type { RowDataPacket } from "mysql2/promise";

interface SensitiveRow extends RowDataPacket {
  id: number;
  nik_encrypted: string;
  npwp_encrypted: string | null;
  bank_account_encrypted: string | null;
}

async function main(): Promise<void> {
  const rows = await queryRows<SensitiveRow>("SELECT id, nik_encrypted, npwp_encrypted, bank_account_encrypted FROM employees ORDER BY id");
  const candidates = rows.filter((row) => [row.nik_encrypted, row.npwp_encrypted, row.bank_account_encrypted].some((value) => value !== null && needsReencryption(value)));
  if (process.argv.includes("--dry-run")) {
    console.log(`Sensitive fields requiring re-encryption: ${candidates.length}`);
    return;
  }
  const updated = await withTransaction(async (connection) => {
    let count = 0;
    for (const row of candidates) {
      const nik = needsReencryption(row.nik_encrypted) ? reencryptField(row.nik_encrypted) : row.nik_encrypted;
      const npwp = row.npwp_encrypted && needsReencryption(row.npwp_encrypted) ? reencryptField(row.npwp_encrypted) : row.npwp_encrypted;
      const bank = row.bank_account_encrypted && needsReencryption(row.bank_account_encrypted) ? reencryptField(row.bank_account_encrypted) : row.bank_account_encrypted;
      await connection.execute("UPDATE employees SET nik_encrypted=?, npwp_encrypted=?, bank_account_encrypted=? WHERE id=?", [nik, npwp, bank, row.id]);
      count += 1;
    }
    return count;
  });
  console.log(`Sensitive fields re-encrypted for ${updated} employee record(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Re-encryption failed.");
  process.exitCode = 1;
}).finally(() => closePool());
