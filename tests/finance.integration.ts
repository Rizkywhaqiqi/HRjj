import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { financeDirectory } from "../src/modules/finance/queries";
import { getLetter } from "../src/modules/letters/queries";
import { getPool } from "../src/core/db";
import type { SessionUser } from "../src/types/database";
test(
  "finance joins and salary timelines work against migrated MySQL; approvals cannot duplicate an effective date",
  { skip: process.env.HR_RUN_DB_INTEGRATION !== "1" },
  async () => {
    assert.equal(process.env.CI, "true");
    assert.equal(process.env.DB_HOST, "127.0.0.1");
    const conn = await createConnection({
      host: "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const code = "FIN-" + randomUUID().slice(0, 12);
    let id = 0;
    const created: {table:string;id:number}[]=[];
    async function insert(table:string,columns:string,values: (string|number)[]) {
      const [r]=await conn.execute<import('mysql2/promise').ResultSetHeader>(`INSERT INTO ${table} (${columns}) VALUES (${values.map(()=>'?').join(',')})`,values);
      created.unshift({table,id:r.insertId});return r.insertId;
    }
    try {
      const brandId=await insert('brands','code,name',[code,code]);
      const companyId=await insert('companies','brand_id,name',[brandId,code]);
      const divisionId=await insert('divisions','name',[code]);
      const positionId=await insert('positions','division_id,name',[divisionId,code]);
      const locationId=await insert('locations','brand_id,name',[brandId,code]);
      const org=[{company_id:companyId,brand_id:brandId,position_id:positionId,location_id:locationId}];
      const [users] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users LIMIT 1",
      );
      const userId = Number(users[0].id);
      const [result] = await conn.execute<
        import("mysql2/promise").ResultSetHeader
      >(
        "INSERT INTO employees(employee_code,full_name,company_id,brand_id,position_id,location_id,join_date) VALUES (?,?,?,?,?,?,?)",
        [
          code,
          "Finance Integration",
          org[0].company_id,
          org[0].brand_id,
          org[0].position_id,
          org[0].location_id,
          "2026-01-01",
        ],
      );
      id = result.insertId;
      await conn.execute(
        "INSERT INTO salary_changes(employee_id,amount,effective_date,reason,requested_by,status) VALUES (?,?,?,?,?,'APPROVED'),(?,?,?,?,?,'APPROVED'),(?,?,?,?,?,'PENDING')",
        [
          id,
          "1700000",
          "2026-10-01",
          "Initial salary",
          userId,
          id,
          "1900000",
          "2026-11-01",
          "Salary adjustment",
          userId,
          id,
          "2000000",
          "2027-01-01",
          "Pending future",
          userId,
        ],
      );
      await assert.rejects(
        () =>
          conn.execute(
            "INSERT INTO salary_changes(employee_id,amount,effective_date,reason,requested_by,status) VALUES (?,?,?,?,?,'APPROVED')",
            [id, "1800000", "2026-10-01", "Duplicate date", userId],
          ),
        { code: "ER_DUP_ENTRY" },
      );
      const actor = {
        id: userId,
        scopeAll: true,
        brandIds: [],
        permissions: ["finance.view"],
      } as unknown as SessionUser;
      const [letter]=await conn.execute<import('mysql2/promise').ResultSetHeader>("INSERT INTO letters(letter_number,type,employee_id,company_id,file_path,status,issued_date,metadata,created_by) VALUES (?,'CONTRACT',?,?,?,'ISSUED','2026-11-01',?,?)",[code,id,org[0].company_id,'snapshot:test',JSON.stringify({salary:'1900000'}),userId]);
    assert.equal(await getLetter({...actor,permissions:['letter.view']},letter.insertId),null);
    assert.ok(await getLetter({...actor,permissions:['letter.view','finance.view']},letter.insertId));
    const oct = await financeDirectory(actor, {
        month: "2026-10",
        search: code,
      });
      assert.equal(oct.rows.length, 1);
      assert.equal(Number(oct.rows[0].amount), 1700000);
      assert.equal(Number(oct.rows[0].pending), 1);
      const nov = await financeDirectory(actor, {
        month: "2026-11",
        search: code,
      });
      assert.equal(Number(nov.rows[0].amount), 1900000);
      assert.equal(Number(nov.summary.changed), 1);
      assert.equal(Number(nov.rows[0].ready), 0);
      const denied = await financeDirectory(
        { ...actor, scopeAll: false, brandIds: [] },
        { month: "2026-11", search: code },
      );
      assert.equal(denied.rows.length, 0);
    } finally {
      if (id) {
        await conn.execute("DELETE FROM letters WHERE employee_id=?", [id]);
      await conn.execute("DELETE FROM salary_changes WHERE employee_id=?", [
          id,
        ]);
        await conn.execute("DELETE FROM employees WHERE id=?", [id]);
      }
      for(const row of created) await conn.execute(`DELETE FROM ${row.table} WHERE id=?`,[row.id]);
      await conn.end();
      await getPool().end();
    }
  },
);
