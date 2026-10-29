"use client";
import { useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/http";
import { expireClientSession, saveUser, type CurrentUser } from "@/lib/session";
import { lastActivity, lastRenewal, recordActivity, recordRenewal, sessionIsIdle, startSessionActivity, SESSION_IDLE_MS } from "@/lib/session-activity";
export function SessionActivity() {
  const [remaining, setRemaining] = useState(SESSION_IDLE_MS);
  const [ending, setEnding] = useState(false);
  const renewing = useRef(false);
  const ended = useRef(false);
  async function renew(force = false) {
    if (renewing.current || ended.current) return;
    renewing.current = true;
    async function send() {
      if (!force && Date.now() - lastRenewal() < 60_000) return;
      const result = await requestJson<{ user: CurrentUser }>("/auth/refresh", { method: "POST", body: "{}" }); saveUser(result.user); recordRenewal();
    }
    try {
      if (navigator.locks) await navigator.locks.request("careops-session-renew", { ifAvailable: true }, async lock => { if (lock) await send(); });
      else await send();
    }
    catch { /* 401 redirects centrally; transient failures keep the current session. */ }
    finally { renewing.current = false; }
  }
  function finish(manual = false) {
    if (ended.current) return;
    ended.current = true; setEnding(true);
    void fetch(manual ? "/api/auth/logout" : "/api/auth/end-session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}", keepalive: true }).catch(() => {});
    expireClientSession(manual ? "expired" : "idle");
  }
  useEffect(() => {
    if (sessionIsIdle()) { finish(); return; }
    if (!lastActivity()) startSessionActivity();
    function activity() { if (sessionIsIdle()) { finish(); return; } recordActivity(); }
    function tick() {
      if (sessionIsIdle()) { finish(); return; }
      const now = Date.now(); setRemaining(Math.max(0, SESSION_IDLE_MS - (now - lastActivity())));
      if (lastActivity() > lastRenewal() && now - lastRenewal() >= 60_000 && document.visibilityState === "visible") void renew();
    }
    const events = ["pointerdown", "pointermove", "keydown", "scroll", "wheel", "touchstart"] as const;
    events.forEach(name => window.addEventListener(name, activity, { passive: true }));
    const visibility = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", tick); window.addEventListener("storage", tick);
    const timer = window.setInterval(tick, 1000); tick();
    return () => { window.clearInterval(timer); events.forEach(name => window.removeEventListener(name, activity)); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("focus", tick); window.removeEventListener("storage", tick); };
  }, []);
  if (ending) return <div className="session-idle-overlay" role="alert">Phiên làm việc đã kết thúc. Đang chuyển về đăng nhập…</div>;
  if (remaining > 60_000) return null;
  return <div className="session-idle-notice" role="alert"><div><strong>Phiên làm việc sắp hết hạn</strong><p>Bạn chưa thao tác trong một lúc. Tự đăng xuất sau {Math.ceil(remaining / 1000)} giây.</p></div><button className="auth-primary" onClick={() => { recordActivity(); setRemaining(SESSION_IDLE_MS); void renew(true); }}>Tiếp tục làm việc</button><button className="auth-secondary" onClick={() => finish(true)}>Đăng xuất</button></div>;
}
