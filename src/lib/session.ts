export type CurrentUser = { id: number; email: string; name: string; role: string; departmentId?: number | null; departmentName?: string | null };
import { endSessionActivity } from "./session-activity";
let currentUser: CurrentUser | null = null;
export function saveUser(user: CurrentUser) { currentUser = user; }
export function getStoredUser() { return currentUser; }
export function clearClientSession() {
  currentUser = null;
  if (typeof window === "undefined") return;
  for (const key of ["accessToken", "refreshToken", "currentUser"]) {
    try { window.localStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
  }
  for (const name of ["accessToken", "refreshToken"]) document.cookie = `${name}=; path=/; Max-Age=0; SameSite=Lax`;
}
export function expireClientSession(reason = "expired") {
  endSessionActivity();
  clearClientSession();
  if (typeof window !== "undefined" && !["/login", "/forgot-password"].includes(window.location.pathname)) window.location.replace(`/login?reason=${reason === "idle" ? "idle" : "expired"}`);
}
