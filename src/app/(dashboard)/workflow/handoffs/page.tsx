"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { ManagementDialog } from "@/components/management/ManagementDialog";
type Person = { id: number; name: string };
type Task = {
  id: number;
  title: string;
  assigneeId: number;
  assignee: string;
  progress: number;
  status: string;
  locked?: boolean;
};
type Handoff = {
  id: number;
  initiatorId: number;
  receiverId: number;
  initiatorName: string;
  receiverName: string;
  reason: string;
  state: string;
  taskCount: number;
  createdAt: string;
};
type Page = { items: Handoff[]; total: number; page: number };
const stateLabels: Record<string, string> = {
  pending: "Chờ tiếp nhận",
  accepted: "Đã tiếp nhận",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
};
export default function HandoffsPage() {
  const user = getStoredUser(),
    manage = !!user && ["admin", "manager", "leader"].includes(user.role);
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [people, setPeople] = useState<Person[]>([]),
    [tasks, setTasks] = useState<Task[]>([]),
    [selected, setSelected] = useState<number[]>([]);
  const [source, setSource] = useState(""),
    [receiver, setReceiver] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [records, setRecords] = useState<Page>({
      items: [],
      total: 0,
      page: 1,
    }),
    [creating, setCreating] = useState(false),
    [active, setActive] = useState<Handoff | null>(null),
    [preview, setPreview] = useState<Task[]>([]),
    [decisionReason, setDecisionReason] = useState("");
  async function refresh(page = 1) {
    setRecords(await api.get<Page>(`/work/coordination/handoffs?page=${page}`));
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const cap = await api.get<{ enabled: boolean }>(
          "/work/coordination/capabilities",
        );
        if (!alive) return;
        setEnabled(cap.enabled);
        if (!cap.enabled) return;
        const page = await api.get<Page>("/work/coordination/handoffs");
        if (alive) setRecords(page);
        if (manage) {
          const options = await api.get<{ assignees: Person[] }>(
            "/work/lookups",
          );
          if (alive) setPeople(options.assignees);
        }
      } catch (failure) {
        if (alive)
          setError(
            failure instanceof Error
              ? failure.message
              : "Không tải được bàn giao.",
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, [manage]);
  async function loadTasks() {
    if (busy || !source) return;
    setBusy(true);
    setError("");
    setSelected([]);
    try {
      const results = await Promise.all(
        ["todo", "doing"].map((status) =>
          api.get<{ items: Task[]; total: number }>(
            `/work/tasks?assigneeId=${source}&status=${status}&limit=200`,
          ),
        ),
      );
      const eligible = results
        .flatMap((result) => result.items)
        .filter((task) => task.status !== "done" && !task.locked);
      setTasks(eligible.slice(0, 200));
      if (results.reduce((sum, result) => sum + result.total, 0) > 200)
        setNotice(
          "Danh sách chưa hoàn thành vượt 200 việc. Lần này chỉ hiển thị tối đa 200 việc đủ điều kiện; xử lý từng đợt rồi tải lại để bàn giao tiếp.",
        );
    } catch (failure) {
      setTasks([]);
      setError(
        failure instanceof Error
          ? failure.message
          : "Không tải được công việc.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/work/coordination/handoffs", {
        taskIds: selected,
        receiverId: Number(receiver),
        reason,
      });
      setCreating(false);
      setSelected([]);
      setTasks([]);
      setReason("");
      setNotice(
        "Đã gửi đề nghị bàn giao. Người nhận cần xác nhận trước khi đổi người thực hiện.",
      );
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Không lập được bàn giao.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function view(record: Handoff) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const detail = await api.get<{ items: Task[] }>(
        `/work/coordination/handoffs/${record.id}`,
      );
      setPreview(detail.items);
      setActive(record);
      setDecisionReason("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Đề nghị không còn hợp lệ; kiểm tra quyền hoặc tình trạng công việc.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function decide(record: Handoff, action: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/work/coordination/handoffs/${record.id}/decision`, {
        action,
        reason: decisionReason,
      });
      setActive(null);
      setNotice("Đã xử lý đề nghị bàn giao.");
      await refresh(records.page);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Không xử lý được bàn giao.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard-page handoff-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">
            Liên tục trách nhiệm · Giữ nguyên lịch sử
          </span>
          <h1 className="page-title">Bàn giao & tiếp nhận</h1>
          <p className="page-description">
            Chỉ đổi người thực hiện sau khi người nhận xác nhận. Cả đợt được cập
            nhật trong một giao dịch.
          </p>
        </div>
        <Link className="secondary-action" href="/workflow">
          Về công việc
        </Link>
      </header>
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
      {enabled === null ? (
        <p role="status">Đang tải cấu hình…</p>
      ) : enabled === false ? (
        <p className="surface-card handoff-record">
          Chức năng chưa được bật trên máy chủ.
        </p>
      ) : (
        <>
          {user?.role !== "viewer" ? (
            <button
              className="secondary-action"
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void api
                  .post("/work/coordination/timer/stop", {})
                  .then(() => setNotice("Đã dừng phiên đo giờ hiện tại."))
                  .catch((failure) =>
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "Không dừng được đo giờ.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Dừng phiên đo giờ hiện tại
            </button>
          ) : null}
          {manage ? (
            <section className="surface-card handoff-form">
              <h2>Lập đề nghị bàn giao</h2>
              <div className="handoff-fields">
                <label>
                  Người đang thực hiện
                  <select
                    aria-label="Người đang thực hiện"
                    className="auth-input"
                    value={source}
                    onChange={(event) => {
                      setSource(event.target.value);
                      setTasks([]);
                      setSelected([]);
                    }}
                    disabled={busy}
                  >
                    <option value="">Chọn người…</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Người tiếp nhận
                  <select
                    aria-label="Người tiếp nhận"
                    className="auth-input"
                    value={receiver}
                    onChange={(event) => {
                      setReceiver(event.target.value);
                      setSelected([]);
                    }}
                    disabled={busy}
                  >
                    <option value="">Chọn người…</option>
                    {people
                      .filter((person) => String(person.id) !== source)
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <button
                className="secondary-action"
                type="button"
                disabled={busy || !source}
                onClick={() => void loadTasks()}
              >
                Tải việc chưa hoàn thành
              </button>
              {tasks.length ? (
                <>
                  <p>
                    {selected.length}/{tasks.length} việc được chọn
                  </p>
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setSelected(
                        selected.length === tasks.length
                          ? []
                          : tasks.map((task) => task.id),
                      )
                    }
                  >
                    {selected.length === tasks.length
                      ? "Bỏ chọn tất cả"
                      : "Chọn toàn bộ danh sách"}
                  </button>
                  <div className="handoff-tasks">
                    {tasks.map((task) => (
                      <label className="handoff-task" key={task.id}>
                        <input
                          type="checkbox"
                          checked={selected.includes(task.id)}
                          disabled={busy}
                          onChange={(event) =>
                            setSelected((ids) =>
                              event.target.checked
                                ? [...ids, task.id]
                                : ids.filter((id) => id !== task.id),
                            )
                          }
                        />
                        <span>
                          {task.title}
                          <small>
                            {task.progress}% · {task.assignee}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <p>
                  Chọn người rồi tải danh sách. Việc đã hoàn thành hoặc đang
                  khóa không được bàn giao.
                </p>
              )}
              <label>
                Lý do bàn giao
                <textarea
                  className="auth-input"
                  value={reason}
                  maxLength={1000}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={busy}
                />
              </label>
              <button
                type="button"
                className="primary-action"
                disabled={
                  busy ||
                  !selected.length ||
                  !receiver ||
                  source === receiver ||
                  reason.trim().length < 3
                }
                onClick={() => setCreating(true)}
              >
                Kiểm tra & gửi đề nghị
              </button>
            </section>
          ) : null}
          <section
            className="handoff-page"
            aria-label="Đề nghị bàn giao của tôi"
          >
            <h2>Đề nghị liên quan đến tôi</h2>
            {records.items.length ? (
              records.items.map((record) => (
                <article
                  className="surface-card handoff-record"
                  key={record.id}
                >
                  <div className="handoff-record-header">
                    <strong>
                      {record.initiatorName} → {record.receiverName}
                    </strong>
                    <span className="workflow-state">
                      {stateLabels[record.state] || record.state}
                    </span>
                  </div>
                  <p>
                    {record.taskCount} công việc · {record.reason}
                  </p>
                  <time>
                    {new Date(record.createdAt).toLocaleString("vi-VN")}
                  </time>
                  {record.state === "pending" ? (
                    <div className="workflow-inline-actions">
                      <button
                        className="secondary-action"
                        type="button"
                        disabled={busy}
                        onClick={() => void view(record)}
                      >
                        Kiểm tra danh sách & xác nhận
                      </button>
                      <button
                        className="secondary-action"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setPreview([]);
                          setActive(record);
                          setDecisionReason("");
                        }}
                      >
                        Từ chối / hủy đề nghị
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="surface-card handoff-record">
                Chưa có đề nghị bàn giao.
              </p>
            )}
            {records.total > 20 ? (
              <div className="workflow-pagination">
                <button
                  type="button"
                  disabled={busy || records.page <= 1}
                  onClick={() =>
                    void refresh(records.page - 1).catch((failure) =>
                      setError(failure.message),
                    )
                  }
                >
                  Trước
                </button>
                <span>
                  Trang {records.page}/{Math.ceil(records.total / 20)}
                </span>
                <button
                  type="button"
                  disabled={busy || records.page * 20 >= records.total}
                  onClick={() =>
                    void refresh(records.page + 1).catch((failure) =>
                      setError(failure.message),
                    )
                  }
                >
                  Sau
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
      {creating ? (
        <ManagementDialog
          title="Xác nhận gửi bàn giao"
          busy={busy}
          onClose={() => setCreating(false)}
        >
          <p>
            Người tiếp nhận:{" "}
            <strong>
              {people.find((person) => person.id === Number(receiver))?.name}
            </strong>
          </p>
          <p>{reason}</p>
          <ul>
            {tasks
              .filter((task) => selected.includes(task.id))
              .map((task) => (
                <li key={task.id}>{task.title}</li>
              ))}
          </ul>
          <p>Công việc vẫn thuộc người cũ cho đến khi người nhận xác nhận.</p>
          {error ? <p role="alert">{error}</p> : null}
          <button
            className="primary-action"
            type="button"
            disabled={busy}
            onClick={() => void create()}
          >
            Gửi đề nghị bàn giao
          </button>
        </ManagementDialog>
      ) : null}
      {active ? (
        <ManagementDialog
          title={`Xử lý bàn giao #${active.id}`}
          busy={busy}
          onClose={() => setActive(null)}
        >
          <p>{active.reason}</p>
          <ul>
            {preview.map((task) => (
              <li key={task.id}>
                {task.title} · {task.progress}%
              </li>
            ))}
          </ul>
          <label>
            Lý do xác nhận / từ chối
            <textarea
              className="auth-input"
              value={decisionReason}
              maxLength={1000}
              onChange={(event) => setDecisionReason(event.target.value)}
            />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          <div className="workflow-inline-actions">
            {active.receiverId === user?.id ? (
              <>
                <button
                  type="button"
                  className="primary-action"
                  disabled={
                    busy || !preview.length || decisionReason.trim().length < 3
                  }
                  onClick={() => void decide(active, "accept")}
                >
                  Xác nhận tiếp nhận toàn bộ
                </button>
                <button
                  type="button"
                  className="danger-action"
                  disabled={busy || decisionReason.trim().length < 3}
                  onClick={() => void decide(active, "reject")}
                >
                  Từ chối bàn giao
                </button>
              </>
            ) : null}
            {active.initiatorId === user?.id ? (
              <button
                type="button"
                className="danger-action"
                disabled={busy || decisionReason.trim().length < 3}
                onClick={() => void decide(active, "cancel")}
              >
                Hủy đề nghị bàn giao
              </button>
            ) : null}
          </div>
        </ManagementDialog>
      ) : null}
    </div>
  );
}
