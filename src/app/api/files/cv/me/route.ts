import { readStoredFile } from "@/core/storage/files";
import { NextResponse } from "next/server";
import { getCandidateSessionUser } from "@/core/auth/candidate-session";
import { queryRows } from "@/core/db";
import type { RowDataPacket } from "mysql2/promise";
import { logAudit } from "@/core/audit/log";
interface FileRow extends RowDataPacket { cv_file_path: string | null; }
export async function GET() { const candidate = await getCandidateSessionUser(); if (!candidate) return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); const rows = await queryRows<FileRow>("SELECT cv_file_path FROM candidates WHERE account_id=? LIMIT 1", [candidate.accountId]); const relative = rows[0]?.cv_file_path; if (!relative || !relative.startsWith("cv/") || relative.includes("..")) return NextResponse.json({ error: "Not found" }, { status: 404 }); try { const data = await readStoredFile(`private/${relative}`); await logAudit({ userId: null, action: "security.sensitive_read", entityType: "candidate_cv", entityId: candidate.accountId, details: { access: "candidate_owner" } }); return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=curriculum-vitae.pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); } catch { return NextResponse.json({ error: "File tidak tersedia" }, { status: 404 }); } }
