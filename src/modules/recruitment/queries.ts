import type { RowDataPacket } from "mysql2/promise";
import { queryRows } from "@/core/db";
import { brandScope } from "@/core/rbac/scope";
import type { SessionUser } from "@/types/database";

export interface VacancyListItem extends RowDataPacket {
  id: number; title: string; slug: string; description: string; requirements: string;
  company_name: string; brand_name: string; position_name: string; location_name: string; published_at: string | null;
}

export interface CandidateApplication extends RowDataPacket {
  id: number; title: string; company_name: string; stage: string; applied_at: string; consent_withdrawn_at: string | null;
}

export function listOpenVacancies(): Promise<VacancyListItem[]> {
  return queryRows<VacancyListItem>(`SELECT v.id, v.title, v.slug, v.description, v.requirements,
    c.name AS company_name, b.name AS brand_name, p.name AS position_name,
    l.name AS location_name, v.published_at
    FROM vacancies v INNER JOIN companies c ON c.id = v.company_id
    INNER JOIN brands b ON b.id = c.brand_id INNER JOIN positions p ON p.id = v.position_id
    INNER JOIN locations l ON l.id = v.location_id
    WHERE v.status = 'OPEN' AND (v.closed_at IS NULL OR v.closed_at >= CURDATE())
    ORDER BY v.published_at DESC, v.created_at DESC`);
}
export interface InternalVacancy extends RowDataPacket { id: number; title: string; company_id: number; position_id: number; location_id: number; company_name: string; brand_name: string; position_name: string; location_name: string; quota: number; status: string; published_at: string | null; }
export function listInternalVacancies(user: SessionUser): Promise<InternalVacancy[]> { const scope = brandScope(user, "c.id"); return queryRows<InternalVacancy>(`SELECT v.id, v.title, v.company_id, v.position_id, v.location_id, c.name AS company_name, b.name AS brand_name, p.name AS position_name, l.name AS location_name, v.quota, v.status, v.published_at FROM vacancies v INNER JOIN companies c ON c.id=v.company_id INNER JOIN brands b ON b.id=c.brand_id INNER JOIN positions p ON p.id=v.position_id INNER JOIN locations l ON l.id=v.location_id WHERE ${scope.clause} ORDER BY v.created_at DESC`, scope.params); }

export function getVacancyBySlug(slug: string): Promise<VacancyListItem | null> {
  return queryRows<VacancyListItem>(`SELECT v.id, v.title, v.slug, v.description, v.requirements,
    c.name AS company_name, b.name AS brand_name, p.name AS position_name,
    l.name AS location_name, v.published_at
    FROM vacancies v INNER JOIN companies c ON c.id = v.company_id
    INNER JOIN brands b ON b.id = c.brand_id INNER JOIN positions p ON p.id = v.position_id
    INNER JOIN locations l ON l.id = v.location_id WHERE v.slug = ? AND v.status = 'OPEN' LIMIT 1`, [slug]).then((rows) => rows[0] ?? null);
}

export function listCandidateApplications(candidateId: number): Promise<CandidateApplication[]> {
  return queryRows<CandidateApplication>(`SELECT a.id, v.title, c.name AS company_name, a.stage, a.applied_at, a.consent_withdrawn_at
    FROM applications a INNER JOIN vacancies v ON v.id = a.vacancy_id INNER JOIN companies c ON c.id = v.company_id
    WHERE a.candidate_id = ? ORDER BY a.applied_at DESC`, [candidateId]);
}
export interface CandidateProfile extends RowDataPacket { full_name: string; email: string; phone: string; birth_place: string | null; birth_date: string | null; address_current: string | null; last_education: string | null; cv_file_path: string | null; }
export function getCandidateProfile(accountId: number): Promise<CandidateProfile | null> { return queryRows<CandidateProfile>(`SELECT c.full_name, c.email, c.phone, c.birth_place, c.birth_date, c.address_current, c.last_education, c.cv_file_path FROM candidates c WHERE c.account_id=? LIMIT 1`, [accountId]).then((rows) => rows[0] ?? null); }

export interface ApplicationListItem extends RowDataPacket {
  id: number;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  vacancy_title: string;
  company_name: string;
  brand_name: string;
  stage: string;
  applied_at: string;
  consent_policy_version: string;
  rehire_severity: string | null;
  acceptance_reason: string | null;
  rejection_reason: string | null;
  employee_staging_id: number | null;
  employee_id: number | null;
}
export function listApplications(user: SessionUser): Promise<ApplicationListItem[]> {
  const scope = brandScope(user, "co.id");
  return queryRows<ApplicationListItem>(`SELECT a.id, a.candidate_id, ca.full_name AS candidate_name, ca.email AS candidate_email, v.title AS vacancy_title, co.name AS company_name, b.name AS brand_name, a.stage, a.applied_at, a.consent_policy_version, a.acceptance_reason, a.rejection_reason, es.id AS employee_staging_id, COALESCE(es.employee_id, e.id) AS employee_id, (SELECT GROUP_CONCAT(DISTINCT er.severity ORDER BY FIELD(er.severity, 'RED', 'YELLOW', 'GREEN')) FROM employees old_e INNER JOIN exit_reasons er ON er.id=old_e.exit_reason_id WHERE (old_e.email=cnd.email OR old_e.phone=cnd.phone OR old_e.nik_hash=cnd.nik_hash)) AS rehire_severity FROM applications a INNER JOIN candidates cnd ON cnd.id=a.candidate_id INNER JOIN candidate_accounts ca ON ca.id=cnd.account_id INNER JOIN vacancies v ON v.id=a.vacancy_id INNER JOIN companies co ON co.id=v.company_id INNER JOIN brands b ON b.id=co.brand_id LEFT JOIN employee_import_staging es ON es.application_id=a.id LEFT JOIN employees e ON e.application_id=a.id WHERE ${scope.clause} ORDER BY a.applied_at DESC`, scope.params);
}
