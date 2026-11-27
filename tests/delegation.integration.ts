import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createConnection, createPool } from "mysql2/promise";
import {
  assertRoleAssignment,
  assertManageUser,
} from "../src/modules/users/delegation";
import type { SessionUser } from "../src/types/database";

test(
  "MySQL delegation prevents privilege escalation, cross-brand reset and protected-admin takeover",
  { skip: process.env.HR_RUN_DB_INTEGRATION !== "1" },
  async () => {
    assert.equal(process.env.CI, "true");
    assert.equal(process.env.DB_HOST, "127.0.0.1");
    const opts = {
      host: "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };
    const admin = await createConnection(opts);
    const database = `hr_delegation_test_${randomBytes(8).toString("hex")}`;
    const pool = createPool({ ...opts, database });
    try {
      await admin.query(`CREATE DATABASE ${database}`);
      await pool.query(
        "CREATE TABLE roles(id INT PRIMARY KEY,name VARCHAR(80)) ENGINE=InnoDB",
      );
      await pool.query(
        "CREATE TABLE permissions(id INT PRIMARY KEY,code VARCHAR(80)) ENGINE=InnoDB",
      );
      await pool.query(
        "CREATE TABLE role_permissions(role_id INT,permission_id INT) ENGINE=InnoDB",
      );
      await pool.query(
        "CREATE TABLE users(id INT PRIMARY KEY,role_id INT,scope_all BOOL) ENGINE=InnoDB",
      );
      await pool.query(
        "CREATE TABLE user_brand_access(user_id INT,brand_id INT) ENGINE=InnoDB",
      );
      await pool.query(
        "INSERT INTO roles VALUES(1,'Super Admin'),(2,'Staff'),(3,'Sensitive')",
      );
      await pool.query(
        "INSERT INTO permissions VALUES(1,'employee.view'),(2,'employee.view_sensitive')",
      );
      await pool.query(
        "INSERT INTO role_permissions VALUES(1,1),(1,2),(2,1),(3,2)",
      );
      await pool.query("INSERT INTO users VALUES(1,1,1),(2,2,0),(3,2,0)");
      await pool.query("INSERT INTO user_brand_access VALUES(2,1),(3,2)");
      const actor = {
        id: 2,
        name: "Dummy",
        email: "dummy@example.test",
        roleId: 2,
        roleName: "Staff",
        scopeAll: false,
        sessionVersion: 0,
        brandIds: [1],
        permissions: ["employee.view", "user.manage"],
      } satisfies SessionUser;
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        await assert.doesNotReject(() =>
          assertRoleAssignment(c, actor, 2, false, [1]),
        );
        await assert.rejects(() =>
          assertRoleAssignment(c, actor, 1, false, [1]),
        );
        await assert.rejects(() =>
          assertRoleAssignment(c, actor, 3, false, [1]),
        );
        await assert.rejects(() => assertRoleAssignment(c, actor, 2, true, []));
        await assert.rejects(() =>
          assertRoleAssignment(c, actor, 2, false, [2]),
        );
        await assert.rejects(() => assertManageUser(c, actor, 1));
        await assert.rejects(() => assertManageUser(c, actor, 3));
        await assert.doesNotReject(() => assertManageUser(c, actor, 2));
        await assert.doesNotReject(() =>
          assertManageUser(
            c,
            { ...actor, roleName: "Super Admin", scopeAll: true },
            1,
          ),
        );
        await c.rollback();
      } finally {
        c.release();
      }
    } finally {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${database}`);
      await admin.end();
    }
  },
);
