import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { executeSql, queryRows, withTransaction } from "@/core/db";

interface ContractReminderRow extends RowDataPacket {
  contract_id: number;
  stage: "INITIAL" | "H7" | "OVERDUE";
  employee_email: string | null;
  employee_name: string;
  end_date: string;
}

const CLAIM_LEASE_MINUTES = 5;

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function claim(row: ContractReminderRow): Promise<string | null> {
  const claimToken = randomUUID();
  return withTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO notification_logs (contract_id, stage, channel, status, attempts)
       VALUES (?, ?, 'EMAIL', 'PENDING', 0)
       ON DUPLICATE KEY UPDATE id = id`,
      [row.contract_id, row.stage],
    );
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE notification_logs
       SET status = 'PROCESSING', attempts = attempts + 1,
           claimed_at = NOW(), claim_token = ?
       WHERE contract_id = ? AND stage = ? AND channel = 'EMAIL'
         AND (
           status IN ('PENDING', 'FAILED')
           OR (
             status = 'PROCESSING'
             AND claimed_at < DATE_SUB(NOW(), INTERVAL ${CLAIM_LEASE_MINUTES} MINUTE)
           )
         )`,
      [claimToken, row.contract_id, row.stage],
    );
    return result.affectedRows === 1 ? claimToken : null;
  });
}

async function sendEmail(row: ContractReminderRow): Promise<void> {
  const providerUrl = process.env.EMAIL_PROVIDER_URL;
  const providerToken = process.env.EMAIL_PROVIDER_TOKEN;
  if (!providerUrl || !providerToken) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  if (!row.employee_email) throw new Error("EMPLOYEE_EMAIL_MISSING");

  const response = await fetch(providerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}` },
    body: JSON.stringify({
      to: row.employee_email,
      subject: `Pengingat kontrak ${row.employee_name}`,
      text: `Kontrak ${row.employee_name} memerlukan tindak lanjut (${row.stage}). Berakhir ${row.end_date}.`,
      idempotencyKey: `contract:${row.contract_id}:${row.stage}:EMAIL`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`EMAIL_PROVIDER_HTTP_${response.status}`);
}

function safeDeliveryError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "EMAIL_PROVIDER_NOT_CONFIGURED" ||
    message === "EMPLOYEE_EMAIL_MISSING" ||
    /^EMAIL_PROVIDER_HTTP_\d{3}$/.test(message)
  ) {
    return message;
  }
  return "EMAIL_DELIVERY_FAILED";
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expected || !safeEqual(provided, expected)) return jsonError("Unauthorized", 401);

  const rows = await queryRows<ContractReminderRow>(
    `SELECT c.id AS contract_id,
       CASE
         WHEN c.end_date < CURDATE() THEN 'OVERDUE'
         WHEN c.end_date = DATE_ADD(CURDATE(), INTERVAL ty.reminder_days DAY) THEN 'INITIAL'
         WHEN c.end_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND ty.reminder_days > 7 THEN 'H7'
       END AS stage,
       e.email AS employee_email, e.full_name AS employee_name, c.end_date
     FROM contracts c INNER JOIN contract_types ty ON ty.id = c.contract_type_id
       INNER JOIN employees e ON e.id = c.employee_id
     WHERE e.is_active = TRUE AND c.status = 'RUNNING' AND c.end_date IS NOT NULL
       AND (c.end_date < CURDATE()
         OR c.end_date = DATE_ADD(CURDATE(), INTERVAL ty.reminder_days DAY)
         OR (c.end_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND ty.reminder_days > 7))`,
  );

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const claimToken = await claim(row);
    if (!claimToken) continue;
    claimed += 1;
    try {
      await sendEmail(row);
    } catch (error) {
      await executeSql(
        `UPDATE notification_logs
         SET status = 'FAILED', last_error = ?, claimed_at = NULL, claim_token = NULL
         WHERE contract_id = ? AND stage = ? AND channel = 'EMAIL' AND claim_token = ?`,
        [safeDeliveryError(error), row.contract_id, row.stage, claimToken],
      );
      failed += 1;
      continue;
    }

    await executeSql(
      `UPDATE notification_logs
       SET status = 'SENT', sent_at = NOW(), last_error = NULL,
           claimed_at = NULL, claim_token = NULL
       WHERE contract_id = ? AND stage = ? AND channel = 'EMAIL' AND claim_token = ?`,
      [row.contract_id, row.stage, claimToken],
    );
    sent += 1;
  }

  return NextResponse.json({ considered: rows.length, claimed, sent, failed }, { headers: { "Cache-Control": "no-store" } });
}
