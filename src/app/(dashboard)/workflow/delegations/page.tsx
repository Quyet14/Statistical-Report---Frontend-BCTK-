"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { ManagementDialog } from "@/components/management/ManagementDialog";
type Delegation = {
  id: number;
  ownerId: number;
  delegateId: number;
  ownerName: string;
  delegateName: string;
  fromDate: string;
  toDate: string;
  reason: string;
  active: boolean;
};
type Data = { items: Delegation[]; people: { id: number; name: string }[] };
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(),
  );
export default function DelegationsPage() {
  const user = getStoredUser(),
    manage = !!user && ["admin", "manager", "leader"].includes(user.role);
  const [data, setData] = useState<Data | null>(null),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const [delegateId, setDelegateId] = useState(""),
    [fromDate, setFromDate] = useState(today),
    [toDate, setToDate] = useState(today),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (!manage) return;
    let alive = true;
    void (async () => {
      try {
        const cap = await api.get<{ enabled: boolean }>(
          "/work/review-delegations/capabilities",
        );
        if (!alive) return;
        setEnabled(cap.enabled);
        if (cap.enabled) {
          const result = await api.get<Data>("/work/review-delegations");
          if (alive) setData(result);
        }
      } catch (failure) {
        if (alive)
          setError(
            failure instanceof Error
              ? failure.message
              : "Không tải được ủy quyền.",
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, [manage]);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/work/review-delegations", {
        delegateId: Number(delegateId),
        fromDate,
        toDate,
        reason,
      });
      setConfirm(false);
      setReason("");
      setData(await api.get<Data>("/work/review-delegations"));
      setNotice("Đã lập ủy quyền có thời hạn.");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Không lưu được ủy quyền.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/work/review-delegations/${id}/revoke`, {});
      setData(await api.get<Data>("/work/review-delegations"));
      setNotice(
        "Đã thu hồi ủy quyền. Các lần duyệt trước vẫn được giữ trong nhật ký.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Không thu hồi được ủy quyền.",
      );
    } finally {
      setBusy(false);
    }
  }
  const days =
    Math.floor(
      (Date.parse(toDate + "T00:00:00Z") -
        Date.parse(fromDate + "T00:00:00Z")) /
        86400000,
    ) + 1;
  return (
    <div className="dashboard-page handoff-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Có thời hạn · Có thể thu hồi</span>
          <h1 className="page-title">Ủy quyền duyệt</h1>
        </div>
        <Link className="secondary-action" href="/workflow">
          Về duyệt công việc
        </Link>
      </header>
      {!manage ? (
        <p className="surface-card handoff-record">
          Chỉ tài khoản quản lý được sử dụng chức năng này.
        </p>
      ) : (
        <>
          {error ? (
            <p className="workflow-alert" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="surface-card handoff-record" role="status">
              {notice}
            </p>
          ) : null}
          {enabled === null && !error ? (
            <p role="status">Đang tải…</p>
          ) : enabled === false ? (
            <p className="surface-card handoff-record">
              Chức năng chưa được bật trên máy chủ.
            </p>
          ) : null}
          {data ? (
            <>
              <form
                className="surface-card handoff-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setConfirm(true);
                }}
              >
                <h2>Lập ủy quyền mới</h2>
                <div className="handoff-fields">
                  <label>
                    Người duyệt thay
                    <select
                      aria-label="Người duyệt thay"
                      className="auth-input"
                      required
                      value={delegateId}
                      disabled={busy}
                      onChange={(event) => setDelegateId(event.target.value)}
                    >
                      <option value="">Chọn quản lý…</option>
                      {data.people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Từ ngày
                    <input
                      className="auth-input"
                      type="date"
                      min={today()}
                      required
                      value={fromDate}
                      disabled={busy}
                      onChange={(event) => setFromDate(event.target.value)}
                    />
                  </label>
                  <label>
                    Đến ngày
                    <input
                      className="auth-input"
                      type="date"
                      min={fromDate}
                      required
                      value={toDate}
                      disabled={busy}
                      onChange={(event) => setToDate(event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Lý do ủy quyền
                  <textarea
                    className="auth-input"
                    required
                    minLength={3}
                    maxLength={1000}
                    value={reason}
                    disabled={busy}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <p>
                  Tối đa 90 ngày, tính cả ngày bắt đầu và kết thúc theo giờ Việt
                  Nam. Các khoảng ủy quyền của bạn không được trùng nhau.
                </p>
                <button
                  className="primary-action"
                  type="submit"
                  disabled={
                    busy ||
                    !delegateId ||
                    reason.trim().length < 3 ||
                    !Number.isFinite(days) ||
                    days < 1 ||
                    days > 90
                  }
                >
                  Kiểm tra & lập ủy quyền
                </button>
              </form>
              <section className="handoff-page">
                <h2>Ủy quyền của tôi · 100 bản gần nhất</h2>
                {data.items.length ? (
                  data.items.map((item) => (
                    <article
                      key={item.id}
                      className="surface-card handoff-record"
                    >
                      <div className="handoff-record-header">
                        <strong>
                          {item.ownerName} → {item.delegateName}
                        </strong>
                        <span className="workflow-state">
                          {!item.active
                            ? "Đã thu hồi"
                            : item.toDate < today()
                              ? "Đã hết hạn"
                              : item.fromDate > today()
                                ? "Chưa đến hạn"
                                : "Đang hiệu lực"}
                        </span>
                      </div>
                      <p>
                        {item.fromDate} → {item.toDate}
                      </p>
                      <p>{item.reason}</p>
                      {item.active && item.ownerId === user?.id ? (
                        <button
                          className="danger-action"
                          type="button"
                          disabled={busy}
                          onClick={() => void revoke(item.id)}
                        >
                          Thu hồi ủy quyền
                        </button>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="surface-card handoff-record">
                    Chưa có ủy quyền liên quan đến bạn.
                  </p>
                )}
              </section>
            </>
          ) : null}
          {confirm ? (
            <ManagementDialog
              title="Xác nhận ủy quyền duyệt"
              busy={busy}
              onClose={() => setConfirm(false)}
            >
              <p>
                Người nhận:{" "}
                <strong>
                  {
                    data?.people.find(
                      (person) => person.id === Number(delegateId),
                    )?.name
                  }
                </strong>
              </p>
              <p>
                {fromDate} → {toDate} · {days} ngày
              </p>
              <p>{reason}</p>
              <p>
                Ủy quyền chỉ áp dụng duyệt/từ chối trong phạm vi hiện tại. Bạn
                có thể thu hồi trước hạn.
              </p>
              {error ? <p role="alert">{error}</p> : null}
              <button
                className="primary-action"
                type="button"
                disabled={busy}
                onClick={() => void save()}
              >
                Xác nhận lập ủy quyền
              </button>
            </ManagementDialog>
          ) : null}
        </>
      )}
    </div>
  );
}
