import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { RowDataPacket } from "mysql2/promise";
import { getSecurityEnv } from "../env";
import { queryRows } from "../db";
import type { EmployeePortalUser } from "@/types/database";

export const EMPLOYEE_SESSION_COOKIE = "employee_session";
function secret(): Uint8Array { return new TextEncoder().encode(getSecurityEnv().AUTH_SECRET); }
interface AccountRow extends RowDataPacket { account_id: number; employee_id: number; employee_code: string; full_name: string; email: string; session_version: number; is_active: 0 | 1; }
export async function createEmployeeSession(accountId: number, sessionVersion: number): Promise<void> { const token = await new SignJWT({ sv: sessionVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(String(accountId)).setIssuer("jojohrspace").setAudience("employee-portal").setJti(randomUUID()).setIssuedAt().setExpirationTime("72h").sign(secret()); (await cookies()).set(EMPLOYEE_SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 72 * 3600 }); }
export async function destroyEmployeeSession(): Promise<void> { (await cookies()).delete(EMPLOYEE_SESSION_COOKIE); }
const loadEmployeeSession = cache(async (): Promise<EmployeePortalUser | null> => { const token = (await cookies()).get(EMPLOYEE_SESSION_COOKIE)?.value; if (!token) return null; try { const { payload } = await jwtVerify(token, secret(), { issuer: "jojohrspace", audience: "employee-portal", algorithms: ["HS256"] }); const accountId = Number(payload.sub); const version = Number(payload.sv); if (!Number.isInteger(accountId) || !Number.isInteger(version)) return null; const rows = await queryRows<AccountRow>(`SELECT ea.id AS account_id, e.id AS employee_id, e.employee_code, e.full_name, ea.email, ea.session_version, ea.is_active FROM employee_accounts ea INNER JOIN employees e ON e.id=ea.employee_id WHERE ea.id=? AND e.is_active=TRUE LIMIT 1`, [accountId]); const row = rows[0]; if (!row || row.is_active !== 1 || row.session_version !== version || !row.employee_code) return null; return { accountId: row.account_id, employeeId: row.employee_id, employeeCode: row.employee_code, fullName: row.full_name, email: row.email, sessionVersion: row.session_version }; } catch { return null; } });
export function getEmployeeSessionUser(): Promise<EmployeePortalUser | null> { return loadEmployeeSession(); }
export async function requireEmployeeSession(): Promise<EmployeePortalUser> { const user = await loadEmployeeSession(); if (!user) redirect("/self-service/login"); return user; }
