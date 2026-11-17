import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "hr_session";

/**
 * Route groups that require an internal staff session. This is only the
 * navigation gate: every page, Server Action, and Route Handler re-verifies the
 * session against the database.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/master-data",
  "/settings",
  "/employees",
  "/contracts",
  "/letters",
  "/reports",
  "/ganti-password",
];

const AUTH_PAGES = ["/login"];

async function hasValidSessionToken(
  token: string | undefined,
): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;

  if (!token || !secret || secret.length < 32) {
    return false;
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "jojohrspace",
      audience: "hr-internal",
      algorithms: ["HS256"],
    });

    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!isProtected && !isAuthPage) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionValid = await hasValidSessionToken(token);

  if (isProtected && !sessionValid) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

    const response = NextResponse.redirect(loginUrl);

    if (token) {
      response.cookies.delete(SESSION_COOKIE);
    }

    return response;
  }

  if (isAuthPage && sessionValid) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
