export const SESSION_IDLE_MS = 30 * 60_000;
const activityKey = "careops-last-activity";
const renewedKey = "careops-last-renewal";
const endedKey = "careops-session-ended";
const memory: Record<string, number> = {};
function read(key: string) { try { return typeof window === "undefined" ? 0 : Number(window.localStorage.getItem(key) ?? memory[key]) || 0; } catch { return memory[key] ?? 0; } }
function write(key: string, value: number) { memory[key] = value; try { if (typeof window !== "undefined") window.localStorage.setItem(key, String(value)); } catch { /* Per-tab memory remains available. */ } }
export function lastActivity() { return read(activityKey); }
export function lastRenewal() { return read(renewedKey); }
export function sessionIsIdle(now = Date.now()) { const last = lastActivity(); return read(endedKey) > 0 || (last > 0 && now - last >= SESSION_IDLE_MS); }
export function recordActivity() { const now = Date.now(); if (now - lastActivity() >= 1000) write(activityKey, now); }
export function recordRenewal() { write(renewedKey, Date.now()); }
export function startSessionActivity() { write(endedKey, 0); write(activityKey, Date.now()); recordRenewal(); }
export function endSessionActivity() { write(endedKey, Date.now()); }
