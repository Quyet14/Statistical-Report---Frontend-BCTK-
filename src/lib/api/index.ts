import { requestJson } from "../http";
export const API_BASE_URL = "/api";
export const api = {
  get: <T>(url: string) => requestJson<T>(url),
  post: <T>(url: string, body: unknown) => requestJson<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) => requestJson<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) => requestJson<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(url: string) => requestJson<T>(url, { method: "DELETE" }),
};
