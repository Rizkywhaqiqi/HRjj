import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { brandScope } from "@/core/rbac/scope";
import { logAudit } from "@/core/audit/log";

interface FileRow extends RowDataPacket { file_path: string; letter_number: string; status: string; }
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const actor = await requirePermission(PERMISSIONS.letterView); const id = Number((await params).id); if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Not found" }, { status: 404 }); const scope = brandScope(actor, "l.company_id"); const rows = await queryRows<FileRow>(`SELECT l.file_path, l.letter_number, l.status FROM letters l WHERE l.id = ? AND l.status = 'ISSUED' AND ${scope.clause} LIMIT 1`, [id, ...scope.params]); const row = rows[0]; if (!row || !row.file_path.startsWith("letters/") || row.file_path.includes("..")) return NextResponse.json({ error: "Not found" }, { status: 404 }); try { const data = await readFile(path.resolve(process.cwd(), "storage", "private", row.file_path)); await logAudit({ userId: actor.id, action: "security.sensitive_read", entityType: "letter_file", entityId: id, details: { access: "download" } }); return new NextResponse(data, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${row.letter_number.replaceAll("/", "-")}.docx"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); } catch { return NextResponse.json({ error: "File tidak tersedia" }, { status: 404 }); } }
