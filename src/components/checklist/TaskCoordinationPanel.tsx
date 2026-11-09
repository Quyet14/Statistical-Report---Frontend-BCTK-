"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useTasks } from "@/context/TaskContext";
import { ManagementDialog } from "@/components/management/ManagementDialog";
type Detail = {
  estimateMinutes: number;
  totalSeconds: number;
  activeTimer: { userId: number; actorName: string; seconds: number } | null;
  activeTimers?: { userId: number; actorName: string; seconds: number }[];
  entries: {
    id: number;
    actorName: string;
    seconds: number;
    startedAt: string;
  }[];
  returnRequestedBy: number | null;
  returnReason: string | null;
  canManage: boolean;
  canStart: boolean;
  canReturn: boolean;
  canWithdraw: boolean;
  canTransfer: boolean;
};
type Person = { id: number; name: string };
const duration = (seconds: number) =>
  `${Math.floor(seconds / 3600)} giờ ${Math.floor((seconds % 3600) / 60)} phút ${Math.floor(seconds % 60)} giây`;
export function TaskCoordinationPanel({
  taskId,
  revision,
}: {
  taskId: string;
  revision: string;
}) {
  const { refreshTask } = useTasks();
  const [open, setOpen] = useState(false),
    [data, setData] = useState<Detail | null>(null),
    [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [estimate, setEstimate] = useState("0"),
    [reason, setReason] = useState(""),
    [receiver, setReceiver] = useState("");
  const [clock, setClock] = useState(0),
    [sampled, setSampled] = useState(0);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const key = JSON.stringify([taskId, revision]);
  const user = getStoredUser();
  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      try {
        const cap = await api.get<{ enabled: boolean }>(
          "/work/coordination/capabilities",
        );
        if (!active) return;
        setEnabled(cap.enabled);
        if (cap.enabled) {
          const response = await api.get<Detail>(
            `/work/coordination/tasks/${taskId}`,
          );
          if (!active) return;
          setData(response);
          setEstimate(String(response.estimateMinutes));
          setSampled(Date.now());
          setClock(Date.now());
          if (response.canTransfer) {
            const options = await api.get<{ assignees: Person[] }>(
              "/work/lookups",
            );
            if (active) setPeople(options.assignees);
          }
        }
        if (active) setError("");
      } catch (failure) {
        if (active) {
          setData(null);
          setError(
            failure instanceof Error
              ? failure.message
              : "Không tải được điều phối công việc.",
          );
        }
      } finally {
        if (active) setLoaded(key);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, taskId, key]);
  useEffect(() => {
    if (!open || (!data?.activeTimer && !data?.activeTimers?.length)) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, data?.activeTimer, data?.activeTimers?.length]);
  async function act(action: string, body: unknown = {}) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const path =
        action === "stop"
          ? "/work/coordination/timer/stop"
          : `/work/coordination/tasks/${taskId}/${action}`;
      if (action === "estimate") await api.put(path, body);
      else await api.post(path, body);
      await refreshTask(taskId);
      const response = await api.get<Detail>(
        `/work/coordination/tasks/${taskId}`,
      );
      setData(response);
      setEstimate(String(response.estimateMinutes));
      setSampled(Date.now());
      setClock(Date.now());
      setReason("");
      setNotice("Đã cập nhật công việc.");
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Không thực hiện được thao tác.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const running =
    data?.activeTimers ?? (data?.activeTimer ? [data.activeTimer] : []);
  const extra = running.reduce(
    (sum, timer) =>
      sum +
      Math.max(0, Math.min(43200 - timer.seconds, (clock - sampled) / 1000)),
    0,
  );
  return (
    <details
      className="task-coordination"
      onToggle={(event) => {
        if (event.target !== event.currentTarget) return;
        const next = event.currentTarget.open;
        if (next) {
          setLoaded(null);
          setError("");
        }
        setOpen(next);
      }}
    >
      <summary>
        Thời gian & chuyển việc{" "}
        <span>
          {data ? `${data.estimateMinutes} phút dự kiến` : "Điều phối"}
        </span>
      </summary>
      {open ? (
        <div
          className="task-coordination-body"
          aria-busy={busy || loaded !== key}
        >
          {loaded !== key ? <p role="status">Đang tải…</p> : null}
          {enabled === false ? (
            <p>Chức năng chưa được bật trên máy chủ.</p>
          ) : null}
          {error ? (
            <p className="coordination-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p role="status">{notice}</p> : null}
          {loaded === key && enabled && data ? (
            <>
              <div className="coordination-clock">
                <span>Thời gian thực tế</span>
                <strong>{duration(data.totalSeconds + extra)}</strong>
                <small>
                  Dự kiến {data.estimateMinutes} phút · Mỗi phiên đo tối đa 12
                  giờ
                </small>
              </div>
              {data.activeTimer ? (
                <p role="status">
                  Đang đo: {data.activeTimer.actorName}
                  {data.activeTimer.seconds +
                    Math.max(0, (clock - sampled) / 1000) >=
                  43200
                    ? " · Đã đạt giới hạn; hãy dừng phiên."
                    : ""}
                </p>
              ) : null}
              {running.length > 1 ? (
                <p>
                  {running.length} người đang đo giờ. Tổng thời gian cộng từ các
                  phiên của nhóm.
                </p>
              ) : null}
              <div className="coordination-actions">
                {data.canStart && !data.activeTimer ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("start")}
                  >
                    Bắt đầu đo giờ
                  </button>
                ) : null}
                {data.activeTimer?.userId === user?.id ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act("stop")}
                  >
                    Dừng đo giờ
                  </button>
                ) : null}
              </div>
              <p>
                Thời gian được lưu ở máy chủ và tiếp tục khi đóng trang. Hoàn
                thành, gửi duyệt hoặc chuyển/trả việc sẽ kết thúc phiên đo.
              </p>
              {data.canTransfer ? (
                <form
                  className="coordination-estimate"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void act("estimate", { minutes: Number(estimate) });
                  }}
                >
                  <label>
                    Ước lượng (phút)
                    <input
                      type="number"
                      min={0}
                      max={43200}
                      required
                      value={estimate}
                      disabled={busy}
                      onChange={(event) => setEstimate(event.target.value)}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      !Number.isInteger(Number(estimate)) ||
                      Number(estimate) < 0 ||
                      Number(estimate) > 43200
                    }
                  >
                    Lưu ước lượng
                  </button>
                </form>
              ) : null}
              {data.returnRequestedBy ? (
                <p className="coordination-warning">
                  Đang yêu cầu trả việc: {data.returnReason}
                </p>
              ) : null}
              {data.canReturn || data.canTransfer || data.canWithdraw ? (
                <>
                  <label>
                    Lý do xử lý
                    <textarea
                      aria-label="Lý do điều phối"
                      value={reason}
                      maxLength={1000}
                      disabled={busy}
                      placeholder="Ghi rõ lý do chuyển, trả hoặc tiếp tục công việc…"
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  <div className="coordination-actions">
                    {data.canReturn ? (
                      <button
                        type="button"
                        disabled={busy || reason.trim().length < 3}
                        onClick={() => void act("return", { reason })}
                      >
                        Yêu cầu trả việc
                      </button>
                    ) : null}
                    {data.returnRequestedBy &&
                    (data.canManage || data.canWithdraw) ? (
                      <button
                        type="button"
                        disabled={busy || reason.trim().length < 3}
                        onClick={() => void act("resolve-return", { reason })}
                      >
                        {data.canWithdraw
                          ? "Rút yêu cầu trả việc"
                          : "Cho tiếp tục công việc"}
                      </button>
                    ) : null}
                  </div>
                  {data.canTransfer ? (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        setConfirmTransfer(true);
                      }}
                    >
                      <label>
                        Chuyển người thực hiện
                        <select
                          aria-label="Người nhận công việc"
                          value={receiver}
                          required
                          disabled={busy}
                          onChange={(event) => setReceiver(event.target.value)}
                        >
                          <option value="">Chọn người nhận…</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        disabled={busy || !receiver || reason.trim().length < 3}
                      >
                        Chuyển việc kèm lý do
                      </button>
                    </form>
                  ) : null}
                </>
              ) : null}
              {data.entries.length ? (
                <details>
                  <summary>Nhật ký đo giờ · 20 phiên gần nhất</summary>
                  <ul>
                    {data.entries.map((entry) => (
                      <li key={entry.id}>
                        <strong>{entry.actorName}</strong>
                        <span>{duration(entry.seconds)}</span>
                        <small>
                          {new Date(entry.startedAt).toLocaleString("vi-VN")}
                        </small>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <Link href="/workflow/handoffs">
                Bàn giao công việc & xác nhận tiếp nhận →
              </Link>
              {confirmTransfer ? (
                <ManagementDialog
                  title="Xác nhận chuyển công việc"
                  busy={busy}
                  onClose={() => setConfirmTransfer(false)}
                >
                  <p>
                    Người nhận:{" "}
                    <strong>
                      {
                        people.find((person) => person.id === Number(receiver))
                          ?.name
                      }
                    </strong>
                  </p>
                  <p>{reason}</p>
                  <p>
                    Checklist, tiến độ và lịch sử được giữ lại. Phiên đo giờ
                    hiện tại sẽ kết thúc.
                  </p>
                  {error ? <p role="alert">{error}</p> : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        if (
                          await act("transfer", {
                            receiverId: Number(receiver),
                            reason,
                          })
                        )
                          setConfirmTransfer(false);
                      })()
                    }
                  >
                    Xác nhận chuyển việc
                  </button>
                </ManagementDialog>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
