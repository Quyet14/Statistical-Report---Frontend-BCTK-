import { API_BASE_URL } from "./api";

export class AuthRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AuthRequestError";
  }
}

export type LoginResponse = {
  message: string;
  email: string;
};

export type VerifyLoginOtpResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
    departmentId?: number | null;
    departmentName?: string | null;
  };
};

export type CurrentUser = VerifyLoginOtpResponse["user"];

export type ForgotPasswordResponse = {
  message: string;
  email: string;
};

export type ResetPasswordResponse = {
  message: string;
  email: string;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Không thể kết nối tới máy chủ. Hãy chắc chắn backend đang chạy trên http://localhost:3010.");
  }

  if (!response.ok) {
    let errorMessage = "Yêu cầu không thành công";

    try {
      const payload = await response.json();
      errorMessage = payload?.message ?? payload?.error ?? errorMessage;
    } catch {
      // Ignore JSON parse errors and keep fallback message.
    }

    throw new AuthRequestError(errorMessage, response.status);
  }

  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyLoginOtp(email: string, otp: string): Promise<VerifyLoginOtpResponse> {
  return request<VerifyLoginOtpResponse>("/auth/verify-login-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  return request<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<ResetPasswordResponse> {
  return request<ResetPasswordResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, otp, newPassword }),
  });
}

export function saveTokens(accessToken: string, refreshToken: string) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
  document.cookie = `accessToken=${encodeURIComponent(accessToken)}; path=/; SameSite=Lax`;
  document.cookie = `refreshToken=${encodeURIComponent(refreshToken)}; path=/; SameSite=Lax`;
}

export function saveUser(user: CurrentUser) {
  if (typeof window !== "undefined") {
    localStorage.setItem("currentUser", JSON.stringify(user));
  }
}

export function getStoredUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem("currentUser");
    const user = value ? JSON.parse(value) as CurrentUser : null;
    return user && Number.isFinite(user.id) && typeof user.role === "string" ? user : null;
  } catch {
    return null;
  }
}

export async function refreshCurrentUser(): Promise<CurrentUser> {
  const token = getStoredToken();
  if (!token) throw new AuthRequestError("Vui lòng đăng nhập", 401);
  try {
    const user = await request<CurrentUser>("/auth/me", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!Number.isFinite(user.id) || !user.email || !user.role) {
      throw new Error("Máy chủ trả về thông tin tài khoản không hợp lệ.");
    }
    // Current database role and department replace cached values, including null.
    saveUser(user);
    return user;
  } catch (error) {
    if (error instanceof AuthRequestError && (error.status === 401 || error.status === 403)) clearTokens();
    throw error;
  }
}

export function clearTokens() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("currentUser");
  document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = localStorage.getItem("accessToken");
  if (token) return token;
  const cookie = document.cookie.split("; ").find((item) => item.startsWith("accessToken="))?.slice("accessToken=".length);
  try {
    return cookie ? decodeURIComponent(cookie) : null;
  } catch {
    return null;
  }
}
