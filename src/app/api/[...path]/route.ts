import { NextRequest, NextResponse } from "next/server";
import { verifiedWriteOrigin, signedClientHeaders, SecurityConfigurationError } from "../../../lib/server-security";
import { captchaCookie, captchaStore } from "../../../lib/captcha";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const sessionCookie = "careops_session";
const refreshCookie = "careops_refresh";
const deviceCookie = "careops_device";
type Tokens = { accessToken: string; refreshToken: string; sessionExpiresAt?: number; deviceToken?: string; deviceExpiresAt?: number; user: unknown };
const publicAuth = new Set(["auth/login", "auth/verify-login-otp", "auth/forgot-password", "auth/reset-password"]);
const roots = new Set(["auth", "users", "departments", "branches", "tasks", "kpi", "reports", "task-logs", "notifications"]);
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
function clearSession(response: NextResponse) {
  for (const name of [sessionCookie, refreshCookie, "accessToken", "refreshToken"]) response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
function json(message: string, status: number, code?: string) {
  return NextResponse.json({ message, ...(code ? { code } : {}) }, { status, headers: { "Cache-Control": "no-store" } });
}
function setSession(response: NextResponse, result: Tokens) {
  response.cookies.set(sessionCookie, result.accessToken, { ...cookieOptions, maxAge: 900 });
  const remaining = Math.floor(((result.sessionExpiresAt ?? Date.now() + 43_200_000) - Date.now()) / 1000);
  response.cookies.set(refreshCookie, result.refreshToken, { ...cookieOptions, maxAge: Math.max(1, Math.min(43_200, remaining)) });
  if (result.deviceToken && result.deviceExpiresAt) response.cookies.set(deviceCookie, result.deviceToken, { ...cookieOptions, maxAge: Math.max(1, Math.min(2_592_000, Math.floor((result.deviceExpiresAt - Date.now()) / 1000))) });
  return response;
}
function clearDevice(response: NextResponse) { response.cookies.set(deviceCookie, "", { ...cookieOptions, maxAge: 0 }); return response; }
function validTokens(result: Tokens) { return typeof result.accessToken === "string" && typeof result.refreshToken === "string" && !!result.user; }
function nearingExpiry(token: string) {
  try { const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()); return typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now() + 60_000; }
  catch { return true; }
}
async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path.length || !roots.has(path[0]) || path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) return json("Not found", 404);
  const endpoint = path.join("/");
  const writing = !["GET", "HEAD"].includes(request.method);
  if (writing) {
    try { if (!verifiedWriteOrigin(request.headers)) return json("Không thể xác minh nguồn yêu cầu", 403, "INVALID_REQUEST_ORIGIN"); }
    catch { return json("Chưa cấu hình origin frontend", 503); }
    if (["POST", "PATCH", "PUT"].includes(request.method) && request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return json("JSON required", 415);
  }
  const logout = ["auth/logout", "auth/end-session", "auth/forget-device"].includes(endpoint);
  const deviceStatus = endpoint === "auth/device-status";
  const resumeDevice = endpoint === "auth/resume-device";
  const refresh = endpoint === "auth/refresh";
  if ((logout || refresh || deviceStatus || resumeDevice) && request.method !== "POST") return json("Method not allowed", 405);
  const isPublic = publicAuth.has(endpoint) && request.method === "POST";
  let token = request.cookies.get(sessionCookie)?.value;
  const refreshToken = request.cookies.get(refreshCookie)?.value;
  const deviceToken = request.cookies.get(deviceCookie)?.value;
  if (logout && !refreshToken && !deviceToken) return clearSession(clearDevice(json("Đã đăng xuất", 200)));
  if ((!isPublic && !logout && !deviceStatus && !resumeDevice && !token && !refreshToken && !(endpoint === "auth/me" && deviceToken)) || (refresh && !refreshToken)) return clearSession(json("Vui lòng đăng nhập lại", 401));
  try {
    let body: Uint8Array | undefined;
    if (writing && request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) { await reader.cancel(); return json("Dữ liệu vượt quá giới hạn", 413); }
        chunks.push(value);
      }
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    }
    if (process.env.NODE_ENV === "production" && !process.env.API_BACKEND_URL) return json("Cần cấu hình API_BACKEND_URL trỏ tới NestJS", 503);
    const configured = (process.env.API_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010").replace(/\/+$/, "");
    const base = new URL(configured.endsWith("/api") ? `${configured}/` : `${configured}/api/`);
    if (!["http:", "https:"].includes(base.protocol) || (process.env.NODE_ENV === "production" && base.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname))) return json("Cấu hình máy chủ không hợp lệ", 503);
    const upstreamUrl = new URL(endpoint, base);
    upstreamUrl.search = new URL(request.url).search;
    let clientHeaders;
    try { clientHeaders = signedClientHeaders(request.headers, request.method, upstreamUrl); }
    catch (error) { return error instanceof SecurityConfigurationError ? json("Chưa cấu hình proxy tin cậy", 503) : json("Không thể xác minh proxy đầu vào", 403, "UNTRUSTED_GATEWAY"); }
    async function callSession(action: "refresh" | "logout" | "end-session" | "resume-device" | "device-status" | "forget-device") {
      const url = new URL(`auth/${action}`, base);
      const fields = action === "refresh" || action === "end-session" ? { refreshToken } : { ...(action === "logout" || action === "forget-device" ? { refreshToken } : {}), deviceToken, ...(deviceToken ? { userAgent: (request.headers.get("user-agent") ?? "").slice(0, 512) } : {}) };
      return fetch(url, { method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", Accept: "application/json", ...signedClientHeaders(request.headers, "POST", url) }, body: JSON.stringify(fields) });
    }
    const marked = (response: Response) => process.env.NODE_ENV !== "production" || response.headers.get("x-careops-backend") === "nest-v1";
    if (logout) {
      if (endpoint === "auth/end-session" && !refreshToken) return clearSession(json("Đã kết thúc phiên", 200));
      const result = await callSession(endpoint === "auth/forget-device" ? "forget-device" : endpoint === "auth/end-session" ? "end-session" : "logout");
      if (!marked(result)) return json("Backend phiên đăng nhập không tương thích", 502);
      if (!result.ok && result.status !== 401) return json("Chưa thể thu hồi phiên. Vui lòng thử lại.", result.status);
      const response = clearSession(json("Đã đăng xuất", 200));
      return endpoint === "auth/forget-device" ? clearDevice(response) : response;
    }
    if (deviceStatus) {
      const result = await callSession("device-status");
      if (!marked(result) || !result.ok) return json("Chưa thể kiểm tra thiết bị", 503);
      const data = await result.json(); const response = NextResponse.json({ remembered: data.remembered === true, autoLogin: data.autoLogin === true, expiresAt: data.expiresAt }, { headers: { "Cache-Control": "no-store" } });
      return data.remembered ? response : clearDevice(response);
    }
    let renewed: Tokens | undefined;
    let restored = false;
    if (resumeDevice || (!isPublic && endpoint === "auth/me" && !token && !refreshToken && deviceToken)) {
      if (!writing && !verifiedWriteOrigin(request.headers)) return json("Không thể xác minh nguồn yêu cầu", 403, "INVALID_REQUEST_ORIGIN");
      const result = await callSession("resume-device");
      if (!marked(result)) return json("Backend thiết bị không tương thích", 502);
      if (!result.ok) return result.status === 401 ? clearSession(json("Thiết bị chưa được bật tự đăng nhập. Vui lòng đăng nhập bằng mật khẩu.", 401)) : json("Chưa thể khôi phục phiên. Vui lòng thử lại.", result.status);
      const data: Tokens = await result.json(); if (!validTokens(data)) return json("Phản hồi thiết bị không hợp lệ", 502);
      renewed = data; token = data.accessToken; restored = true;
      if (resumeDevice) return setSession(NextResponse.json({ user: data.user }, { headers: { "Cache-Control": "no-store" } }), data);
    }
    if (!restored && (refresh || (!isPublic && refreshToken && (!token || nearingExpiry(token))))) {
      if (!writing && !verifiedWriteOrigin(request.headers)) return json("Không thể xác minh nguồn yêu cầu", 403, "INVALID_REQUEST_ORIGIN");
      let result = await callSession("refresh");
      if (result.status === 401 && endpoint === "auth/me" && deviceToken) { result = await callSession("resume-device"); restored = result.ok; }
      if (!marked(result)) return json("Backend phiên đăng nhập không tương thích", 502);
      if (!result.ok) {
        const response = json(result.status === 401 ? "Phiên đăng nhập đã hết hạn" : "Chưa thể gia hạn phiên. Vui lòng thử lại.", result.status);
        if (result.headers.get("retry-after")) response.headers.set("Retry-After", result.headers.get("retry-after")!);
        return result.status === 401 ? clearSession(response) : response;
      }
      const data: Tokens = await result.json();
      if (!validTokens(data)) return json("Phản hồi gia hạn không hợp lệ", 502);
      renewed = data; token = data.accessToken;
      if (refresh) return setSession(NextResponse.json({ user: data.user }, { headers: { "Cache-Control": "no-store" } }), data);
    }
    if (endpoint === "auth/login" && request.method === "POST") {
      let fields;
      try { fields = JSON.parse(new TextDecoder().decode(body)); } catch { return json("Dữ liệu đăng nhập không hợp lệ", 400); }
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) return json("Dữ liệu đăng nhập không hợp lệ", 400);
      if (!captchaStore.consume(request.cookies.get(captchaCookie)?.value ?? "", fields.captcha, clientHeaders["X-CareOps-Client-IP"] ?? "local-development")) return json("Mã CAPTCHA không đúng hoặc đã hết hạn. Vui lòng nhập mã mới.", 400);
      delete fields.captcha;
      delete fields.deviceToken; delete fields.userAgent;
      if (deviceToken) fields.deviceToken = deviceToken;
      fields.userAgent = (request.headers.get("user-agent") ?? "").slice(0, 512);
      body = new TextEncoder().encode(JSON.stringify(fields));
    }
    if (endpoint === "auth/verify-login-otp" && request.method === "POST") {
      let fields;
      try { fields = JSON.parse(new TextDecoder().decode(body)); } catch { return json("Dữ liệu OTP không hợp lệ", 400); }
      if (!fields || typeof fields !== "object" || Array.isArray(fields)) return json("Dữ liệu OTP không hợp lệ", 400);
      delete fields.deviceToken; delete fields.userAgent;
      if (deviceToken) fields.deviceToken = deviceToken;
      fields.userAgent = (request.headers.get("user-agent") ?? "").slice(0, 512);
      body = new TextEncoder().encode(JSON.stringify(fields));
    }
    const upstream = await fetch(upstreamUrl, {
      method: request.method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", Accept: "application/json", ...clientHeaders, ...(!isPublic && token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body as BodyInit | undefined,
    });
    if (process.env.NODE_ENV === "production" && upstream.headers.get("x-careops-backend") !== "nest-v1") return json("API_BACKEND_URL không trỏ tới backend NestJS tương thích", 502);
    const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) headers.set("Retry-After", retryAfter);
    if (["auth/login", "auth/verify-login-otp"].includes(endpoint) && upstream.ok) {
      const result = await upstream.json();
      if (endpoint === "auth/login" && !result.accessToken) return NextResponse.json({ message: result.message, email: result.email }, { headers });
      if (!validTokens(result)) return json("Phản hồi đăng nhập không hợp lệ", 502);
      const response = clearSession(NextResponse.json({ user: result.user, ...(endpoint === "auth/login" ? { authenticated: true } : {}) }, { headers }));
      if (!result.deviceToken) clearDevice(response);
      return setSession(response, result);
    }
    const payload = restored && endpoint === "auth/me" && upstream.ok ? JSON.stringify({ ...await upstream.json(), sessionRestored: true }) : upstream.status === 204 || request.method === "HEAD" ? null : await upstream.text();
    const response = new NextResponse(payload, { status: upstream.status, headers });
    response.headers.set("Content-Type", upstream.headers.get("content-type")?.includes("application/json") ? "application/json" : "text/plain; charset=utf-8");
    if (upstream.status === 401 && !isPublic) clearSession(response);
    else if (renewed) setSession(response, renewed);
    if (endpoint === "auth/reset-password" && upstream.ok) clearDevice(clearSession(response));
    return response;
  } catch { return json("Không thể kết nối máy chủ. Vui lòng thử lại.", 503); }
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
