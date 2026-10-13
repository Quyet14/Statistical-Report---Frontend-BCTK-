const configuredApiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3010").replace(/\/$/, "");
export const API_BASE_URL = configuredApiUrl.endsWith("/api") ? configuredApiUrl : `${configuredApiUrl}/api`;

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  get: async <T>(url: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${url}`, { cache: "no-store", headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  },

  post: async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  },

  put: async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  },

  patch: async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  },

  del: async <T>(url: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${url}`, { method: "DELETE", headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json();
  },
};
