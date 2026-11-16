import type { RowDataPacket } from "mysql2/promise";

export type MaritalStatus = "SINGLE" | "MARRIED" | "DIVORCED";
export type ExitSeverity = "GREEN" | "YELLOW" | "RED";
export type ApplicationStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW_HR"
  | "INTERVIEW_USER"
  | "TEST"
  | "OFFERING"
  | "ACCEPTED"
  | "REJECTED"
  | "HIRED";
export type ContractStatus =
  | "RUNNING"
  | "EXTENDED"
  | "MADE_PERMANENT"
  | "NOT_EXTENDED"
  | "ENDED";
export type LetterType = "SP" | "SKK" | "CONTRACT" | "NDA" | "STILL_WORKING";

type DateTime = string | Date;

export interface BrandRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: 0 | 1;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface CompanyRow extends RowDataPacket {
  id: number;
  brand_id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  npwp: string | null;
  nib: string | null;
  is_active: 0 | 1;
  brand_name?: string;
  brand_code?: string;
}

export interface DivisionRow extends RowDataPacket {
  id: number;
  name: string;
  is_active: 0 | 1;
  position_count?: number;
}

export interface PositionRow extends RowDataPacket {
  id: number;
  division_id: number;
  name: string;
  is_active: 0 | 1;
  division_name?: string;
  employee_count?: number;
}

export interface LocationRow extends RowDataPacket {
  id: number;
  brand_id: number | null;
  name: string;
  city: string | null;
  address: string | null;
  is_active: 0 | 1;
  brand_name?: string | null;
}

export interface ExitReasonRow extends RowDataPacket {
  id: number;
  name: string;
  severity: ExitSeverity;
  rehirable: 0 | 1;
  is_active: 0 | 1;
}

export interface ContractTypeRow extends RowDataPacket {
  id: number;
  name: string;
  default_months: number | null;
  reminder_days: number;
  is_permanent: 0 | 1;
  is_active: 0 | 1;
}

export interface RoleRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  is_system: 0 | 1;
  created_at: DateTime;
  updated_at: DateTime;
}

export interface RoleListRow extends RoleRow {
  user_count: number;
  permission_count: number;
}

export interface PermissionRow extends RowDataPacket {
  id: number;
  code: string;
  module: string;
  description: string;
}

export interface RolePermissionRow extends RowDataPacket {
  role_id: number;
  permission_id: number;
}

export interface UserRow extends RowDataPacket {
  id: number;
  role_id: number;
  name: string;
  email: string;
  password_hash: string;
  session_version: number;
  scope_all: 0 | 1;
  is_active: 0 | 1;
  last_login_at: DateTime | null;
  created_at: DateTime;
  updated_at: DateTime;
  role_name: string;
}

export interface UserListRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  scope_all: 0 | 1;
  is_active: 0 | 1;
  last_login_at: DateTime | null;
  created_at: DateTime;
}

export interface UserBrandAccessRow extends RowDataPacket {
  user_id: number;
  brand_id: number;
}

export interface FeatureFlagRow extends RowDataPacket {
  feature_key: string;
  label: string;
  is_enabled: 0 | 1;
  updated_at: DateTime;
}

export interface AuditLogRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  ip_address: string | null;
  created_at: DateTime;
  user_name: string | null;
}

export interface CountRow extends RowDataPacket {
  total: number;
}

export interface EmployeeRow extends RowDataPacket {
  id: number;
  employee_code: string;
  full_name: string;
  company_id: number | null;
  brand_id: number;
  position_id: number;
  location_id: number;
  join_date: string | null;
  is_active: 0 | 1;
  exit_date: string | null;
  exit_reason_id: number | null;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleName: string;
  scopeAll: boolean;
  sessionVersion: number;
  brandIds: number[];
  permissions: string[];
}

export interface StaffSessionToken {
  userId: number;
  sessionVersion: number;
}

export interface CandidateSessionUser {
  accountId: number;
  fullName: string;
  email: string;
  sessionVersion: number;
}

export interface EmployeePortalUser {
  accountId: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  email: string;
  sessionVersion: number;
}

