import { readStoredFile } from "@/core/storage/files";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { directBrandScope } from "@/core/rbac/scope";
import { logAudit } from "@/core/audit/log";

interface KtpFileRow extends RowDataPacket {
  ktp_photo_path: string | null;
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requirePermission(PERMISSIONS.employeeViewSensitive);
  await requireFeatureEnabled("employees");
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const scope = directBrandScope(actor, "e.brand_id");
  const rows = await queryRows<KtpFileRow>(
    `SELECT e.ktp_photo_path FROM employees e WHERE e.id=? AND ${scope.clause} LIMIT 1`,
    [id, ...scope.params],
  );
  const relative = rows[0]?.ktp_photo_path;
  if (!relative || !relative.startsWith("ktp/") || relative.includes(".."))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const data = await readStoredFile(`private/${relative}`);
    await logAudit({
      userId: actor.id,
      action: "security.sensitive_read",
      entityType: "employee_ktp",
      entityId: id,
      details: { access: "download" },
    });
    const type = relative.endsWith(".png") ? "image/png" : "image/jpeg";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Content-Disposition": "inline; filename=ktp-image",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File tidak tersedia" }, { status: 404 });
  }
}
