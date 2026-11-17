import path from "node:path";
import { readStoredFile } from "@/core/storage/files";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { brandScope } from "@/core/rbac/scope";
import { logAudit } from "@/core/audit/log";

interface PreviewFileRow extends RowDataPacket {
  file_path: string;
  letter_number: string;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission(PERMISSIONS.letterView);
  await requireFeatureEnabled("letters");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scope = brandScope(actor, "l.company_id");
  const rows = await queryRows<PreviewFileRow>(
    `SELECT l.file_path, l.letter_number
     FROM letters l
     WHERE l.id = ? AND ${scope.clause}
     LIMIT 1`,
    [id, ...scope.params],
  );
  const row = rows[0];
  if (
    !row ||
    !row.file_path.startsWith("letters/") ||
    row.file_path.includes("..") ||
    row.file_path.includes("\\") ||
    path.isAbsolute(row.file_path) ||
    !row.file_path.endsWith(".docx")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readStoredFile(`private/${row.file_path}`);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "File tidak tersedia" }, { status: 404 });
    }
    console.error("[letters] preview file read failed", {
      letterId: id,
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "File tidak dapat dibaca" }, { status: 500 });
  }

  await logAudit({
    userId: actor.id,
    action: "security.sensitive_read",
    entityType: "letter_file",
    entityId: id,
    details: { access: "preview" },
  });
  const body = new ArrayBuffer(data.byteLength);
  new Uint8Array(body).set(data);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="${row.letter_number.replaceAll("/", "-")}.docx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
