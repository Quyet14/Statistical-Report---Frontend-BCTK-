import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { contentSecurityPolicy } from "./lib/security-headers";

export function proxy(request: NextRequest) {
  const nonce = randomBytes(24).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");
  const requestHeaders = new Headers(request.headers);
  // Never accept a browser-supplied nonce/CSP as the rendering policy.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("careops_session")?.value ?? "";

  const isProtectedRoute =
    pathname.startsWith("/archive") ||
    pathname.startsWith("/checklist") ||
    pathname.startsWith("/kpi") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/employees") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/departments") ||
    pathname.startsWith("/personal-checklist") ||
    pathname.startsWith("/tasks");

  if (isProtectedRoute && !token && !request.cookies.get("careops_refresh")?.value && !request.cookies.get("careops_device")?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

export default proxy;
