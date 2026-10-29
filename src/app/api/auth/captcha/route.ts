import { NextRequest, NextResponse } from "next/server";
import { captchaCookie, captchaCookieOptions, newCaptcha } from "../../../../lib/captcha";
import { signedClientHeaders, SecurityConfigurationError } from "../../../../lib/server-security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ message: "Nguồn yêu cầu không hợp lệ" }, { status: 403, headers });
  let client: string;
  try {
    const proof = signedClientHeaders(request.headers, "GET", new URL("/api/auth/captcha", request.url));
    client = proof["X-CareOps-Client-IP"] ?? "local-development";
  } catch (error) { return NextResponse.json({ message: "Không thể xác minh gateway" }, { status: error instanceof SecurityConfigurationError ? 503 : 403, headers }); }
  const challenge = await newCaptcha(client, request.cookies.get(captchaCookie)?.value);
  if (!challenge) return NextResponse.json({ message: "Vui lòng chờ trước khi đổi mã xác nhận." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
  const response = NextResponse.json({ image: challenge.image }, { headers });
  response.cookies.set(captchaCookie, challenge.token, captchaCookieOptions);
  return response;
}
