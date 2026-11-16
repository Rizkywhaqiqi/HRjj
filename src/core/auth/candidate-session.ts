import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { RowDataPacket } from "mysql2/promise";
import { getSecurityEnv } from "../env";
import { queryRows } from "../db";
import type { CandidateSessionUser } from "@/types/database";

export const CANDIDATE_SESSION_COOKIE = "candidate_session";

const SESSION_ISSUER = "jojohrspace";
const SESSION_AUDIENCE = "candidate-portal";
const CANDIDATE_SESSION_TTL_HOURS = 72;

interface CandidateAccountRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  session_version: number;
  is_active: 0 | 1;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getSecurityEnv().AUTH_SECRET);
}

export async function createCandidateSession(
  accountId: number,
  sessionVersion: number,
): Promise<void> {
  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(accountId))
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${CANDIDATE_SESSION_TTL_HOURS}h`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(CANDIDATE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CANDIDATE_SESSION_TTL_HOURS * 60 * 60,
  });
}

export async function destroyCandidateSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CANDIDATE_SESSION_COOKIE);
}

const loadCandidateSessionUser = cache(async (): Promise<CandidateSessionUser | null> => {
  const token = (await cookies()).get(CANDIDATE_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
  try {
    ({ payload } = await jwtVerify(token, getSecretKey(), {
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      algorithms: ["HS256"],
    }));
  } catch {
    return null;
  }

  const accountId = Number(payload.sub);
  const sessionVersion = Number(payload.sv);

  if (
    !Number.isInteger(accountId) ||
    accountId <= 0 ||
    !Number.isInteger(sessionVersion) ||
    sessionVersion < 0
  ) {
    return null;
  }

  const rows = await queryRows<CandidateAccountRow>(
    `SELECT id, full_name, email, session_version, is_active
     FROM candidate_accounts
     WHERE id = ?
     LIMIT 1`,
    [accountId],
  );

  const account = rows[0];

  if (
    !account ||
    account.is_active !== 1 ||
    account.session_version !== sessionVersion
  ) {
    return null;
  }

  return {
    accountId: account.id,
    fullName: account.full_name,
    email: account.email,
    sessionVersion: account.session_version,
  };
});

export async function getCandidateSessionUser(): Promise<CandidateSessionUser | null> {
  return loadCandidateSessionUser();
}

export async function requireCandidateSession(): Promise<CandidateSessionUser> {
  const account = await loadCandidateSessionUser();

  if (!account) {
    redirect("/kandidat/login");
  }

  return account;
}
