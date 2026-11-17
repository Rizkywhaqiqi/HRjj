import { NextResponse } from "next/server";
import { getLetter } from "./queries";
import { parseSnapshot } from "./templates";
import { renderLetterPdf } from "./pdf";
import { requireFeatureEnabled, requirePermission } from "@/core/rbac/guard";
import { PERMISSIONS } from "@/core/rbac/permissions";
import { readStoredFile } from "@/core/storage/files";
import { logAudit } from "@/core/audit/log";
export async function letterResponse(rawId: string, preview: boolean) {
  const actor = await requirePermission(PERMISSIONS.letterView);
  await requireFeatureEnabled("letters");
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0)
    return NextResponse.json(
      { error: "Surat tidak ditemukan" },
      { status: 404 },
    );
  const l = await getLetter(actor, id);
  if (!l)
    return NextResponse.json(
      { error: "Surat tidak ditemukan" },
      { status: 404 },
    );
  const snapshot = parseSnapshot(l.metadata);
  let bytes: Buffer;
  let type: string;
  let extension: string;
  if (snapshot) {
    bytes = await renderLetterPdf(snapshot, l.letter_number);
    type = "application/pdf";
    extension = "pdf";
  } else {
    if (!l.file_path.startsWith("letters/") || l.file_path.includes(".."))
      return NextResponse.json(
        { error: "Arsip asli tidak tersedia" },
        { status: 404 },
      );
    try {
      bytes = await readStoredFile(`private/${l.file_path}`);
    } catch {
      return NextResponse.json(
        { error: "Arsip lama tidak tersedia. Pulihkan dokumen dari backup." },
        { status: 404 },
      );
    }
    type =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    extension = "docx";
  }
  await logAudit({
    userId: actor.id,
    action: "security.sensitive_read",
    entityType: "letter_file",
    entityId: id,
    details: { access: preview ? "preview" : "download", snapshot: !!snapshot },
  });
  const filename = l.letter_number.replace(/[^A-Za-z0-9_-]/g, "-");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${preview && snapshot ? "inline" : "attachment"}; filename="${filename}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
