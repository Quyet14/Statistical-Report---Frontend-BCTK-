import { expireClientSession } from "./session";
import { sessionIsIdle } from "./session-activity";
export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAt = 0) { super(message); this.name = "ApiRequestError"; }
}
export function retryAfterSeconds(value: string | null, now = Date.now()) {
  if (value && /^\d+$/.test(value.trim())) return Math.max(1, Number(value));
  const date = value ? Date.parse(value) : NaN;
  return Number.isFinite(date) ? Math.max(1, Math.ceil((date - now) / 1000)) : 60;
}
const blockedUntil: Record<string, number> = { auth: 0, api: 0 };
export function getRequestCooldown(scope: "auth" | "api") {
  let stored = 0;
  try { if (typeof window !== "undefined") stored = Number(window.sessionStorage.getItem(`careops-cooldown-${scope}`)) || 0; } catch { /* Optional persistence. */ }
  return Math.max(blockedUntil[scope], stored);
}
type UploadProgress = (loaded: number, total: number) => void;

async function requestResponse(
  path: string,
  options: RequestInit = {},
  protectedRequest = true,
  onUploadProgress?: UploadProgress,
): Promise<Response> {
  if (protectedRequest && sessionIsIdle()) { expireClientSession("idle"); throw new ApiRequestError("Phiên làm việc đã kết thúc do không hoạt động. Vui lòng đăng nhập lại.", 401); }
  const scope = path.startsWith("/auth/") && options.method === "POST" ? "auth" : "api";
  const deadline = Math.max(getRequestCooldown("api"), getRequestCooldown(scope));
  if (deadline > Date.now()) throw new ApiRequestError("Bạn đang thao tác quá nhanh. Vui lòng chờ trước khi thử lại.", 429, deadline);
  let response: Response;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  try {
    if (onUploadProgress && isFormData && typeof XMLHttpRequest !== "undefined") {
      response = await new Promise<Response>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open(options.method ?? "POST", `/api${path}`);
        request.withCredentials = true;
        request.setRequestHeader("Cache-Control", "no-store");
        new Headers(options.headers).forEach((value, name) => {
          if (name.toLowerCase() !== "content-type") request.setRequestHeader(name, value);
        });
        request.upload.onprogress = (event) => {
          onUploadProgress(event.loaded, event.lengthComputable ? event.total : 0);
        };
        request.onerror = () => reject(new Error("Network request failed"));
        request.onabort = () => reject(new Error("Network request was aborted"));
        request.onload = () => {
          if (request.status === 0) {
            reject(new Error("Network request failed"));
            return;
          }
          const headers = new Headers();
          for (const line of request.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
            const separator = line.indexOf(":");
            if (separator > 0) headers.append(line.slice(0, separator), line.slice(separator + 1).trim());
          }
          const emptyBody = [204, 205, 304].includes(request.status);
          resolve(new Response(emptyBody ? null : request.responseText, { status: request.status, headers }));
        };
        request.send(options.body as FormData);
      });
    } else {
      response = await fetch(`/api${path}`, { ...options, credentials: "same-origin", cache: "no-store", headers: { ...(!isFormData ? { "Content-Type": "application/json" } : {}), ...(options.headers ?? {}) } });
    }
  }
  catch { throw new Error("Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại."); }
  if (!response.ok) {
    let message = "Yêu cầu chưa thành công. Vui lòng thử lại.";
    let code = "";
    try { const data = await response.json(); code = typeof data.code === "string" ? data.code : ""; message = Array.isArray(data.message) ? data.message.filter((part: unknown) => typeof part === "string").join(". ") : typeof data.message === "string" ? data.message : message; } catch { /* Plain rate limit responses use the message below. */ }
    let retryAt = 0;
    if (response.status === 429) {
      retryAt = Date.now() + retryAfterSeconds(response.headers.get("retry-after")) * 1000;
      blockedUntil[scope] = retryAt;
      try { if (typeof window !== "undefined") window.sessionStorage.setItem(`careops-cooldown-${scope}`, String(retryAt)); } catch { /* Memory protection still applies. */ }
      message = "Bạn đang thao tác quá nhanh. Vui lòng chờ trước khi thử lại.";
    } else if (response.status === 401 && protectedRequest) { expireClientSession(); message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."; }
    else if (response.status === 403) message = ["INVALID_REQUEST_ORIGIN", "UNTRUSTED_GATEWAY"].includes(code)
      ? "Địa chỉ truy cập chưa hợp lệ. Vui lòng mở địa chỉ HTTPS của hệ thống qua cổng gateway, rồi thử lại."
      : "Bạn không có quyền thực hiện thao tác này.";
    else if (response.status >= 500) message = "Máy chủ chưa sẵn sàng. Vui lòng thử lại sau.";
    else if (response.status === 401 && path === "/auth/login") message = "Email hoặc mật khẩu không đúng.";
    else if (response.status === 401 && ["/auth/verify-login-otp", "/auth/reset-password"].includes(path)) message = "Mã xác minh không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.";
    throw new ApiRequestError(message.slice(0, 2000), response.status, retryAt);
  }
  return response;
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  protectedRequest = true,
  onUploadProgress?: UploadProgress,
): Promise<T> {
  const response = await requestResponse(path, options, protectedRequest, onUploadProgress);
  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return body ? JSON.parse(body) as T : undefined as T;
}
