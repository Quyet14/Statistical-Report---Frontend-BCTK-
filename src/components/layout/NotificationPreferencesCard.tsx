"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
const labels = {
  upcoming: "Nhắc công việc sắp hạn",
  overdue: "Nhắc công việc quá hạn",
  mentions: "Khi được nhắc tên trong bình luận",
  handoffs: "Đề nghị và kết quả bàn giao",
  approvals: "Công việc chờ duyệt và kết quả duyệt",
};
type Preferences = Record<keyof typeof labels, boolean>;
export function NotificationPreferencesCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [values, setValues] = useState<Preferences | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const cap = await api.get<{ enabled: boolean }>(
          "/notifications/preferences/capabilities",
        );
        if (!active) return;
        setEnabled(cap.enabled);
        if (cap.enabled) {
          const response = await api.get<Preferences>(
            "/notifications/preferences",
          );
          if (active) setValues(response);
        }
      } catch (failure) {
        if (active)
          setError(
            failure instanceof Error
              ? failure.message
              : "Không tải được tùy chọn.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  if (enabled === false) return null;
  return (
    <section className="surface-card handoff-form">
      <h2>Thông báo trong ứng dụng</h2>
      <p>
        Tùy chọn áp dụng cho thông báo phát sinh mới. Thông báo đã nhận được giữ
        trong lịch sử.
      </p>
      {error ? (
        <p role="alert" className="coordination-error">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {!values && !error ? <p role="status">Đang tải tùy chọn…</p> : null}
      {values ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError("");
            setNotice("");
            void api
              .put<Preferences>("/notifications/preferences", values)
              .then((result) => {
                setValues(result);
                setNotice("Đã lưu tùy chọn thông báo.");
              })
              .catch((failure) =>
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Không lưu được tùy chọn.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          <div className="collaboration-people">
            {(Object.keys(labels) as (keyof Preferences)[]).map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={values[key]}
                  disabled={busy}
                  onChange={(event) =>
                    setValues((current) =>
                      current
                        ? { ...current, [key]: event.target.checked }
                        : current,
                    )
                  }
                />
                {labels[key]}
              </label>
            ))}
          </div>
          <button className="primary-action" type="submit" disabled={busy}>
            Lưu tùy chọn thông báo
          </button>
        </form>
      ) : null}
    </section>
  );
}
