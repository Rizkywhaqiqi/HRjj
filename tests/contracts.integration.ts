import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createConnection, createPool } from "mysql2/promise";
import { assertNoContractOverlap } from "../src/modules/contracts/overlap";

// Never target user databases. CI supplies a disposable localhost MySQL service.
test(
  "MySQL serializes competing contracts and detects conflicts across renewal histories",
  { skip: process.env.HR_RUN_DB_INTEGRATION !== "1" },
  async () => {
    assert.equal(process.env.CI, "true");
    assert.equal(process.env.DB_HOST, "127.0.0.1");
    const options = {
      host: "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };
    const admin = await createConnection(options);
    const database = `hr_contract_test_${randomBytes(8).toString("hex")}`;
    const pool = createPool({ ...options, database, connectionLimit: 3 });
    try {
      await admin.query(`CREATE DATABASE ${database}`);
      await pool.query(
        "CREATE TABLE employees (id INT PRIMARY KEY) ENGINE=InnoDB",
      );
      await pool.query(
        "CREATE TABLE contracts (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, start_date DATE NOT NULL, end_date DATE NULL, status VARCHAR(30) NOT NULL) ENGINE=InnoDB",
      );
      await pool.query("INSERT INTO employees VALUES (1)");
      const first = await pool.getConnection();
      const second = await pool.getConnection();
      try {
        await first.beginTransaction();
        await first.execute("SELECT id FROM employees WHERE id=1 FOR UPDATE");
        const competing = (async () => {
          await second.beginTransaction();
          await second.execute(
            "SELECT id FROM employees WHERE id=1 FOR UPDATE",
          );
          try {
            await assertNoContractOverlap(
              second,
              1,
              "2026-11-01",
              "2026-12-31",
            );
            return false;
          } catch {
            return true;
          } finally {
            await second.rollback();
          }
        })();
        await assertNoContractOverlap(first, 1, "2026-11-01", "2026-12-31");
        await first.execute(
          "INSERT INTO contracts (employee_id,start_date,end_date,status) VALUES (1,'2026-11-01','2026-12-31','RUNNING')",
        );
        await first.commit();
        assert.equal(
          await competing,
          true,
          "the second writer must observe the first committed contract",
        );
        await first.beginTransaction();
        await first.execute("SELECT id FROM employees WHERE id=1 FOR UPDATE");
        await assert.doesNotReject(() =>
          assertNoContractOverlap(first, 1, "2027-01-01", "2027-02-28", 1),
        );
        await first.execute(
          "UPDATE contracts SET status='EXTENDED' WHERE id=1",
        );
        await assert.rejects(() =>
          assertNoContractOverlap(first, 1, "2026-12-01", "2027-01-31"),
        );
        await first.execute(
          "INSERT INTO contracts (employee_id,start_date,end_date,status) VALUES (1,'2027-01-01','2027-02-28','RUNNING')",
        );
        await assert.rejects(() =>
          assertNoContractOverlap(first, 1, "2027-01-01", null, 1),
        );
        await first.rollback();
      } finally {
        first.release();
        second.release();
      }
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${database}`);
      await admin.end();
    }
  },
);
