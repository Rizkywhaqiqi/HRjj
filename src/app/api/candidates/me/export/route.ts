import { NextResponse } from "next/server";
import { getCandidateSessionUser } from "@/core/auth/candidate-session";
import { logAudit } from "@/core/audit/log";
import { decryptField } from "@/core/crypto/field-encrypt";
import { queryRows } from "@/core/db";
import type { RowDataPacket } from "mysql2/promise";

interface ProfileRow extends RowDataPacket { full_name: string; email: string; phone: string; nik_encrypted: string | null; birth_place: string | null; birth_date: string | null; address_current: string | null; last_education: string | null; }
interface ApplicationRow extends RowDataPacket { title: string; company_name: string; stage: string; applied_at: string; consent_policy_version: string | null; consent_withdrawn_at: string | null; }

export async function GET() {
  const candidate = await getCandidateSessionUser();
  if (!candidate) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = (await queryRows<ProfileRow>("SELECT full_name, email, phone, nik_encrypted, birth_place, birth_date, address_current, last_education FROM candidates WHERE account_id=? LIMIT 1", [candidate.accountId]))[0];
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const applications = await queryRows<ApplicationRow>(`SELECT v.title, c.name AS company_name, a.stage, a.applied_at, a.consent_policy_version, a.consent_withdrawn_at FROM applications a INNER JOIN vacancies v ON v.id=a.vacancy_id INNER JOIN companies c ON c.id=v.company_id INNER JOIN candidates cd ON cd.id=a.candidate_id WHERE cd.account_id=? ORDER BY a.applied_at DESC`, [candidate.accountId]);
  await logAudit({ userId: null, action: "security.export", entityType: "candidate_data", entityId: candidate.accountId, details: { owner: true, applicationCount: applications.length } });
  return NextResponse.json({ profile: { fullName: profile.full_name, email: profile.email, phone: profile.phone, nik: profile.nik_encrypted ? decryptField(profile.nik_encrypted) : null, birthPlace: profile.birth_place, birthDate: profile.birth_date, addressCurrent: profile.address_current, lastEducation: profile.last_education }, applications }, { headers: { "Content-Disposition": "attachment; filename=candidate-data.json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
