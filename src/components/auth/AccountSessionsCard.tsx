"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ManagementDialog } from "@/components/management/ManagementDialog";
type Session = {
  id: string;
  current: boolean;
  remembered: boolean;
  sameDeviceAsCurrent?: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
};
export function AccountSessionsCard() {
  const [sessions, setSessions] = useState<Session[]>([]),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<Session | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const cap = await api.get<{ enabled: boolean }>(
          "/auth/sessions/capabilities",
        );
        if (!alive) return;
        setEnabled(cap.enabled);
        if (cap.enabled) {
          const result = await api.get<{ items: Session[] }>("/auth/sessions");
          if (alive) setSessions(result.items);
        }
      } catch (failure) {
        if (alive)
          setError(
            failure instanceof Error
              ? failure.message
              : "Không tải được phiên đăng nhập.",
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  async function refresh() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.get<{ items: Session[] }>("/auth/sessions");
      setSessions(result.items);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Không cập nhật được danh sách.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/auth/sessions/${selected.id}/revoke`, {});
      setSelected(null);
      const result = await api.get<{ items: Session[] }>("/auth/sessions");
      setSessions(result.items);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Không kết thúc được phiên.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (enabled === false) return null;
  return (
    <section className="surface-card handoff-form">
      <div className="handoff-record-header">
        <h2>Phiên đăng nhập đang hoạt động</h2>
        <button
          type="button"
          className="secondary-action"
          disabled={busy || enabled !== true}
          onClick={() => void refresh()}
        >
          Làm mới phiên
        </button>
      </div>
      <p>
        Chỉ hiển thị phiên của bạn. Phiên hết hạn sẽ được loại khỏi danh sách;
        thời điểm hoạt động tính theo lần gia hạn gần nhất.
      </p>
      {error ? (
        <p role="alert" className="coordination-error">
          {error}
        </p>
      ) : null}
      {enabled === null && !error ? <p role="status">Đang tải…</p> : null}
      <div className="handoff-page">
        {sessions.map((session) => (
          <article key={session.id} className="handoff-record">
            <div className="handoff-record-header">
              <strong>
                {session.current
                  ? "Phiên hiện tại"
                  : session.sameDeviceAsCurrent
                    ? "Cùng thiết bị hiện tại"
                    : "Phiên trình duyệt khác"}
              </strong>
              <span>
                {session.remembered
                  ? "Có ghi nhớ thiết bị"
                  : "Phiên thông thường"}
              </span>
            </div>
            <p>
              Bắt đầu: {new Date(session.createdAt).toLocaleString("vi-VN")}
              <br />
              Hoạt động:{" "}
              {new Date(session.lastActiveAt).toLocaleString("vi-VN")}
              <br />
              Hạn hiện tại:{" "}
              {new Date(session.expiresAt).toLocaleString("vi-VN")}
            </p>
            {!session.current && !session.sameDeviceAsCurrent ? (
              <button
                type="button"
                className="danger-action"
                disabled={busy}
                onClick={() => setSelected(session)}
              >
                Kết thúc phiên này
              </button>
            ) : null}
          </article>
        ))}
      </div>
      {selected ? (
        <ManagementDialog
          title="Kết thúc phiên từ xa"
          busy={busy}
          onClose={() => setSelected(null)}
        >
          <p>
            Phiên bắt đầu lúc{" "}
            {new Date(selected.createdAt).toLocaleString("vi-VN")} sẽ mất quyền
            truy cập ngay. Nếu có ghi nhớ thiết bị, quyền ghi nhớ liên quan cũng
            được thu hồi.
          </p>
          <p>Thiết bị đó cần đăng nhập và xác minh lại.</p>
          {error ? <p role="alert">{error}</p> : null}
          <button
            type="button"
            className="danger-action"
            disabled={busy}
            onClick={() => void revoke()}
          >
            Xác nhận kết thúc phiên
          </button>
        </ManagementDialog>
      ) : null}
    </section>
  );
}
