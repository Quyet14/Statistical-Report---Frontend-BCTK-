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

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010").replace(/\/$/, "");

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

    throw new Error(errorMessage);
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
  const value = localStorage.getItem("currentUser");
  const token = localStorage.getItem("accessToken");
  const storedUser = value ? JSON.parse(value) as CurrentUser : null;
  if (!token) return storedUser;

  try {
    const payload = JSON.parse(window.atob(token.split(".")[1])) as Partial<CurrentUser> & { sub?: number };
    if (!payload.role || !payload.email || !payload.sub) return storedUser;
    const user = {
      id: payload.sub,
      email: payload.email,
      name: storedUser?.name ?? payload.name ?? payload.email,
      role: payload.role,
      departmentId: storedUser?.departmentId ?? payload.departmentId,
      departmentName: storedUser?.departmentName ?? payload.departmentName,
    };
    saveUser(user);
    return user;
  } catch {
    return null;
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

  return localStorage.getItem("accessToken");
}
