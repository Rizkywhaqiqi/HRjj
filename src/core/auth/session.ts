import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { RowDataPacket } from "mysql2/promise";
import { getSecurityEnv } from "../env";
import { queryRows } from "../db";
import type { SessionUser, StaffSessionToken } from "@/types/database";

export const STAFF_SESSION_COOKIE = "hr_session";

const SESSION_ISSUER = "jojohrspace";
const SESSION_AUDIENCE = "hr-internal";

interface SessionUserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  session_version: number;
  scope_all: 0 | 1;
  is_active: 0 | 1;
}

interface PermissionCodeRow extends RowDataPacket {
  code: string;
}

interface BrandAccessRow extends RowDataPacket {
  brand_id: number;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getSecurityEnv().AUTH_SECRET);
}

/** Issues the signed session cookie. Must run in a Server Action or Route Handler. */
export async function createStaffSession(
  userId: number,
  sessionVersion: number,
): Promise<void> {
  const { SESSION_TTL_HOURS } = getSecurityEnv();

  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 60 * 60,
  });
}

export async function destroyStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_SESSION_COOKIE);
}

/**
 * Verifies signature, expiry, issuer, and audience only. Account state and
 * session version are always re-checked against the database afterwards.
 */
export async function readStaffToken(): Promise<StaffSessionToken | null> {
  const token = (await cookies()).get(STAFF_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      algorithms: ["HS256"],
    });

    const userId = Number(payload.sub);
    const sessionVersion = Number(payload.sv);

    if (
      !Number.isInteger(userId) ||
      userId <= 0 ||
      !Number.isInteger(sessionVersion) ||
      sessionVersion < 0
    ) {
      return null;
    }

    return { userId, sessionVersion };
  } catch {
    return null;
  }
}

/**
 * Data Access Layer loader. Deduplicated per request with React cache so the
 * layout and page share a single database round-trip.
 */
const loadSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readStaffToken();

  if (!token) {
    return null;
  }

  const users = await queryRows<SessionUserRow>(
    `SELECT u.id, u.name, u.email, u.role_id, r.name AS role_name,
            u.session_version, u.scope_all, u.is_active
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [token.userId],
  );

  const user = users[0];

  if (!user || user.is_active !== 1 || user.session_version !== token.sessionVersion) {
    return null;
  }

  const permissionRows = await queryRows<PermissionCodeRow>(
    `SELECT p.code
     FROM role_permissions rp
     INNER JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?
     ORDER BY p.code`,
    [user.role_id],
  );

  const brandRows = await queryRows<BrandAccessRow>(
    "SELECT brand_id FROM user_brand_access WHERE user_id = ? ORDER BY brand_id",
    [user.id],
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role_id,
    roleName: user.role_name,
    scopeAll: user.scope_all === 1,
    sessionVersion: user.session_version,
    brandIds: brandRows.map((row) => row.brand_id),
    permissions: permissionRows.map((row) => row.code),
  };
});

export async function getSessionUser(): Promise<SessionUser | null> {
  return loadSessionUser();
}

export async function requireStaffSession(): Promise<SessionUser> {
  const user = await loadSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
