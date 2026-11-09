import { requestJson } from "../http";
export const API_BASE_URL = "/api";
export const api = {
  get: <T>(url: string) => requestJson<T>(url),
  post: <T>(url: string, body: unknown) => requestJson<T>(url, { method: "POST", body: JSON.stringify(body) }),
  postForm: <T>(url: string, body: FormData) => requestJson<T>(url, { method: "POST", body }),
  postFormWithProgress: <T>(url: string, body: FormData, onProgress: (loaded: number, total: number) => void) =>
    requestJson<T>(url, { method: "POST", body }, true, onProgress),
  put: <T>(url: string, body: unknown) => requestJson<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) => requestJson<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(url: string) => requestJson<T>(url, { method: "DELETE" }),
};
