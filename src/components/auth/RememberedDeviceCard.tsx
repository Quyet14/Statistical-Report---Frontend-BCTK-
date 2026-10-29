"use client";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http";
import { forgetDevice } from "@/lib/auth";
export function RememberedDeviceCard() {
  const [remembered, setRemembered] = useState<boolean | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { let cancelled = false; void requestJson<{ remembered: boolean }>("/auth/device-status", { method: "POST", body: "{}" }, false).then(result => { if (!cancelled) setRemembered(result.remembered); }).catch(() => { if(!cancelled) setError("Chưa thể kiểm tra thiết bị. Vui lòng tải lại trang."); }); return () => { cancelled = true; }; }, []);
  return <section className="remembered-device-card"><div><h2>Thiết bị đăng nhập</h2><p>{remembered === null ? "Đang kiểm tra trạng thái…" : remembered ? "Thiết bị này được ghi nhớ tối đa 30 ngày. Bạn có thể hủy để yêu cầu OTP trở lại." : "Thiết bị này chưa được ghi nhớ. Có thể bật ở lần đăng nhập bằng OTP tiếp theo."}</p>{error ? <p role="alert">{error}</p> : null}</div>{remembered ? <button className="auth-secondary" disabled={busy} onClick={async () => { setBusy(true); try { await forgetDevice(); window.location.replace("/login"); } catch (reason) { setError(reason instanceof Error ? reason.message : "Chưa thể hủy ghi nhớ."); setBusy(false); } }}>Quên thiết bị này và đăng xuất</button> : null}</section>;
}
