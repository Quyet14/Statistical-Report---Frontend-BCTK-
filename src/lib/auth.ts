import { requestJson, ApiRequestError } from "./http";
import { clearClientSession, saveUser, type CurrentUser } from "./session";
import { startSessionActivity, endSessionActivity, sessionIsIdle, recordActivity } from "./session-activity";
export { getStoredUser, saveUser, type CurrentUser } from "./session";
export { ApiRequestError as AuthRequestError } from "./http";
type AuthResponse = { message: string; email: string };
export type VerifyLoginOtpResponse = { user: CurrentUser };
export type LoginResponse = AuthResponse | { authenticated: true; user: CurrentUser };
export type ForgotPasswordResponse = AuthResponse;
export type ResetPasswordResponse = AuthResponse;
const post = <T>(path: string, body: unknown) => requestJson<T>(path, { method: "POST", body: JSON.stringify(body) }, false);
export const login = (email: string, password: string, captcha?: string, rememberDevice?: boolean) => post<LoginResponse>("/auth/login", { email: email.trim().toLowerCase(), password, ...(captcha !== undefined ? { captcha } : {}), ...(rememberDevice !== undefined ? { rememberDevice } : {}) });
export function verifyLoginOtp(email: string, otp: string, rememberDevice?: boolean) {
  if (!/^\d{6}$/.test(otp)) return Promise.reject(new ApiRequestError("Mã OTP phải gồm đúng 6 chữ số.", 400));
  return post<VerifyLoginOtpResponse>("/auth/verify-login-otp", { email: email.trim().toLowerCase(), otp, ...(rememberDevice !== undefined ? { rememberDevice } : {}) }).then(result => { startSessionActivity(); return result; });
}
export const forgotPassword = (email: string) => post<ForgotPasswordResponse>("/auth/forgot-password", { email: email.trim().toLowerCase() });
export function resetPassword(email: string, otp: string, newPassword: string) {
  if (!/^\d{6}$/.test(otp)) return Promise.reject(new ApiRequestError("Mã OTP phải gồm đúng 6 chữ số.", 400));
  return post<ResetPasswordResponse>("/auth/reset-password", { email: email.trim().toLowerCase(), otp, newPassword });
}
export async function refreshCurrentUser(): Promise<CurrentUser> {
  const idle = sessionIsIdle();
  const user = idle ? (await post<{ user: CurrentUser }>("/auth/resume-device", {})).user : await requestJson<CurrentUser & { sessionRestored?: boolean }>("/auth/me", {}, false);
  if (!Number.isFinite(user?.id) || !user.email || !user.role) throw new Error("Thông tin tài khoản không hợp lệ.");
  if (idle || (user as { sessionRestored?: boolean }).sessionRestored) startSessionActivity(); else recordActivity();
  saveUser(user);
  return user;
}
export async function forgetDevice() {
  await post("/auth/forget-device", {}); clearClientSession(); endSessionActivity();
}
export async function clearTokens() {
  const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!response.ok) throw new Error("Chưa thể đăng xuất. Vui lòng thử lại.");
  clearClientSession();
  endSessionActivity();
}
