import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import type { AuditLogRow } from "@/types/database";

interface CountTotalRow extends RowDataPacket {
  total: number;
}

interface ActorRow extends RowDataPacket {
  id: number;
  name: string;
}

interface EntityTypeRow extends RowDataPacket {
  entity_type: string;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  userId?: number;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface AuditLogResult {
  rows: AuditLogRow[];
  total: number;
}

export interface AuditActor {
  id: number;
  name: string;
}

export async function listAuditLogs(filters: AuditLogFilters): Promise<AuditLogResult> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filters.action) {
    clauses.push("a.action LIKE ?");
    params.push(`%${filters.action}%`);
  }

  if (filters.entityType) {
    clauses.push("a.entity_type = ?");
    params.push(filters.entityType);
  }

  if (filters.userId) {
    clauses.push("a.user_id = ?");
    params.push(filters.userId);
  }

  if (filters.from) {
    clauses.push("a.created_at >= ?");
    params.push(`${filters.from} 00:00:00`);
  }

  if (filters.to) {
    clauses.push("a.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(`${filters.to} 00:00:00`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.pageSize;

  const rows = await queryRows<AuditLogRow>(
    `SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.details,
            a.ip_address, a.created_at, u.name AS user_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, filters.pageSize, offset],
  );

  const totalRows = await queryRows<CountTotalRow>(
    `SELECT COUNT(*) AS total FROM audit_logs a ${where}`,
    params,
  );

  return { rows, total: totalRows[0]?.total ?? 0 };
}

export async function listAuditActors(): Promise<AuditActor[]> {
  const rows = await queryRows<ActorRow>(
    "SELECT id, name FROM users ORDER BY name",
  );

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function listAuditEntityTypes(): Promise<string[]> {
  const rows = await queryRows<EntityTypeRow>(
    "SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type",
  );

  return rows.map((row) => row.entity_type);
}
