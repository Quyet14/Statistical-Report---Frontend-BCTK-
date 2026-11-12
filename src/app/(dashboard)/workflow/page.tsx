"use client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useTasks } from "@/context/TaskContext";
import { useFeedback } from "@/context/FeedbackContext";
import { TaskWorkflowPanel } from "@/components/checklist/TaskWorkflowPanel";
import { TaskDependenciesPanel } from "@/components/checklist/TaskDependenciesPanel";
import { TaskCoordinationPanel } from "@/components/checklist/TaskCoordinationPanel";
import { TaskCollaborationPanel } from "@/components/checklist/TaskCollaborationPanel";
import Link from "next/link";
import { formatTaskDate } from "@/lib/presentation";
import type { TaskItem } from "@/types";
import { useLocale } from "@/i18n/locale-provider";
type Person = { id: number; name: string; role?: string; departmentId?: number | null };
type Template = {
  id: number;
  title: string;
  assigneeId: number;
  reviewerId?: number;
  cadence: string;
  anchorDate: string;
  nextRun: string;
  active: boolean;
  version: number;
  checklist: string[];
  priority: string;
  lastError?: string;
};
type Audit = {
  id: number;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
  beforeData: unknown;
  afterData: unknown;
};
const localDay = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const emptyTemplate = () => ({
  title: "",
  assigneeId: "",
  reviewerId: "",
  cadence: "daily",
  startDate: localDay(),
  priority: "medium",
  checklistText: "",
  active: true,
});
const stateLabels: Record<string, string> = {
  draft: "Đang thực hiện",
  submitted: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Cần bổ sung",
  todo: "Chưa làm",
  doing: "Đang làm",
  done: "Hoàn thành",
};
const auditActions: Record<string, string> = {
  create: "Tạo công việc",
  update: "Cập nhật",
  approve: "Đã duyệt",
  reject: "Yêu cầu bổ sung",
  submit: "Gửi duyệt",
  reopen: "Mở lại",
  restore: "Khôi phục",
  delete: "Chuyển vào thùng rác",
  "checklist.update": "Cập nhật checklist",
  "checklist.add": "Thêm mục checklist",
  "review.configure": "Thay đổi người duyệt",
};
const auditFields: Record<string, string> = {
  status: "Trạng thái",
  progress: "Tiến độ",
  title: "Tên công việc",
  titleEn: "Tên tiếng Anh",
  assigneeId: "Mã người thực hiện",
  reviewerId: "Mã người duyệt",
  dueDate: "Hạn hoàn thành",
  priority: "Mức ưu tiên",
  isRecurring: "Công việc lặp lại",
  completed: "Checklist hoàn tất",
  numberValue: "Giá trị",
  signedById: "Mã người xác nhận",
  source: "Nguồn cập nhật",
  approvalState: "Trạng thái duyệt",
  reason: "Lý do",
  delegatedFor: "Ủy quyền cho",
};
const auditRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const auditValue = (key: string, value: unknown, locale: string) => {
  if (value == null || value === "") return locale === "en" ? "Not set" : "Chưa đặt";
  if (key === "status" || key === "approvalState")
    return stateLabels[String(value)] ?? String(value);
  if (key === "progress") return `${value}%`;
  if (key === "priority") {
    const priorities: Record<string, string> = {
      low: "Thấp",
      medium: "Trung bình",
      high: "Cao",
    };
    return priorities[String(value).toLowerCase()] ?? String(value);
  }
  if (key === "dueDate") return formatTaskDate(String(value));
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};
export default function WorkflowPage() {
  const user = getStoredUser();
  const { locale } = useLocale();
  const [, startTransition] = useTransition();
  const manage = !!user && ["admin","manager","leader"].includes(user.role);
  const manageTemplates = !!user && ["admin", "manager"].includes(user.role);
  const { tasks: contextTasks, refreshTask } = useTasks();
  const { runAction } = useFeedback();
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [lookups, setLookups] = useState<{
    assignees: Person[];
    reviewers: Person[];
  }>({ assignees: [], reviewers: [] });
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(emptyTemplate);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [capabilityRetry, setCapabilityRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void api
      .get<{ enabled: boolean }>("/work/capabilities")
      .then((value) => {
        if (!cancelled) setEnabled(value.enabled);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không thể kiểm tra tính năng.",
          );
      });
    if (manage)
      void api
        .get<typeof lookups>("/work/lookups")
        .then(setLookups)
        .catch((reason) => {
          if (!cancelled)
            setError(
              reason instanceof Error
                ? reason.message
                : "Không tải được danh sách nhân sự.",
            );
        });
    return () => {
      cancelled = true;
    };
  }, [manage, capabilityRetry]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError("");
    });
    const load = async () => {
      if (tab === "templates") {
        const data = await api.get<Template[]>("/work/templates");
        if (!cancelled) setTemplates(data);
      } else if (tab === "activity") {
        const data = await api.get<{ items: Audit[]; total: number }>(
          `/work/activity?page=${page}`,
        );
        if (!cancelled) {
          setAudit(data.items);
          setTotal(data.total);
        }
      } else {
        const params = new URLSearchParams({
          page: String(page),
          limit: "25",
          search,
        });
        if (tab === "pending") {
          params.set("approvalState", "submitted");
          if (manage) params.set("reviewerId", String(user?.id));
        }
        if (tab === "trash") params.set("trash", "true");
        if (filter) params.set("status", filter);
        const data = await api.get<{
          items: (Omit<TaskItem, "id"> & { id: string | number })[];
          total: number;
        }>(`/work/tasks?${params}`);
        if (!cancelled) {
          setRows(data.items.map((item) => ({ ...item, id: String(item.id) })));
          setTotal(data.total);
        }
      }
    };
    void load()
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được dữ liệu.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    tab,
    page,
    search,
    filter,
    refresh,
    contextTasks,
    manage,
    user?.id,
  ]);
  const selectedTask = selected
    ? (contextTasks.find((task) => task.id === selected.id) ?? selected)
    : null;
  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      assigneeId: Number(form.assigneeId),
      ...(form.reviewerId ? { reviewerId: Number(form.reviewerId) } : {}),
      cadence: form.cadence,
      startDate: form.startDate,
      priority: form.priority,
      checklist: form.checklistText
        .split("\n")
        .map((text) => text.trim())
        .filter(Boolean),
      active: form.active,
    };
    try {
      const result = await runAction(
        () =>
          editing
            ? api.put(`/work/templates/${editing}`, payload)
            : api.post("/work/templates", payload),
        { title: editing ? "Đã lưu phiên bản mẫu mới" : "Đã tạo mẫu định kỳ" },
      );
      if (result.ok) {
        setShowForm(false);
        setRefresh((value) => value + 1);
      }
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="dashboard-page work-operations-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Điều phối có kiểm soát</span>
          <h3 className="page-title">Duyệt việc & vận hành định kỳ</h3>
        </div>
        <div className="workflow-inline-actions">
        <Link className="secondary-action" href="/workflow/handoffs">Bàn giao & tiếp nhận</Link>
        <Link className="secondary-action" href="/workflow/offline">Làm việc ngoại tuyến</Link>
        {manage ? <Link className="secondary-action" href="/workflow/delegations">Ủy quyền duyệt</Link> : null}
        {manageTemplates && tab === "templates" ? (
          <button
            className="primary-action"
            onClick={() => {
              setEditing(null);
              setForm(emptyTemplate());
              setShowForm(true);
            }}
          >
            + Tạo mẫu lặp lại
          </button>
        ) : null}
        </div>
      </div>
      <div
        className="workflow-tabs"
        role="tablist"
        aria-label="Nghiệp vụ công việc"
      >
        {[
          { id: "pending", label: manage ? "Chờ tôi duyệt" : "Đã gửi duyệt" },
          { id: "all", label: "Công việc" },
          ...(manageTemplates
            ? [
                { id: "templates", label: "Mẫu định kỳ" },
                { id: "activity", label: "Nhật ký" },
                { id: "trash", label: "Thùng rác" },
              ]
            : []),
        ].filter(item => item.id !== "activity" || user?.role !== "leader").map((item) => (
          <button
            role="tab"
            aria-selected={tab === item.id}
            key={item.id}
            onClick={() => {
              setTab(item.id);
              setPage(1);
              setSelected(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? (
        <div className="workflow-alert" role="alert">
          {error}
          <button
            className="secondary-action"
            onClick={() => {
              setError("");
              setCapabilityRetry((value) => value + 1);
              setRefresh((value) => value + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      ) : null}
      {enabled === false ? (
        <div className="panel-card workflow-empty">
          Tính năng này cần hoàn tất cập nhật dữ liệu trên máy chủ trước khi sử
          dụng. Các công việc hiện tại vẫn được giữ nguyên.
        </div>
      ) : null}
      {enabled && !["templates", "activity"].includes(tab) ? (
        <section className="panel-card">
          <div className="workflow-list-toolbar">
            <label>
              Tìm công việc
              <input
                className="auth-input"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Tên việc hoặc người phụ trách…"
              />
            </label>
            <label>
              Trạng thái
              <select
                className="soft-select"
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả</option>
                <option value="todo">Chưa làm</option>
                <option value="doing">Đang làm</option>
                <option value="done">Hoàn thành</option>
              </select>
            </label>
            <strong>{total} công việc</strong>
          </div>
          <div className="workflow-table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Công việc</th>
                  <th>Người thực hiện</th>
                  <th>Hạn</th>
                  <th>Phê duyệt</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <button
                        className="table-title-button"
                        onClick={() => {
                          setSelected(task);
                          setReviewer(String(task.reviewerId ?? ""));
                        }}
                      >
                        {task.title}
                      </button>
                      <small>{task.departmentName ?? task.department}</small>
                    </td>
                    <td>{task.assignee}</td>
                    <td>{formatTaskDate(task.dueDate ?? task.time)}</td>
                    <td>
                      <span
                        className={`workflow-state ${task.approvalState ?? task.status}`}
                      >
                        {stateLabels[task.approvalState ?? task.status]}
                      </span>
                    </td>
                    <td>
                      {tab === "trash" &&
                      (user?.role === "admin" ||
                        task.createdById === user?.id) ? (
                        <button
                          className="secondary-action"
                          onClick={async () => {
                            const result = await runAction(
                              () =>
                                api.post(`/work/tasks/${task.id}/restore`, {}),
                              { title: "Đã khôi phục công việc" },
                            );
                            if (result.ok) setRefresh((value) => value + 1);
                          }}
                        >
                          Khôi phục
                        </button>
                      ) : (
                        <button
                          className="secondary-action"
                          onClick={() => {
                            setSelected(task);
                            setReviewer(String(task.reviewerId ?? ""));
                          }}
                        >
                          Chi tiết
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !rows.length ? (
              <div className="workflow-empty">Không có công việc phù hợp.</div>
            ) : null}
          </div>
        </section>
      ) : null}
      {enabled && tab === "templates" ? (
        <div className="workflow-template-grid">
          {templates.map((template) => (
            <article key={template.id} className="panel-card workflow-template">
              <div className="workflow-template-top">
                <span
                  className={`workflow-state ${template.active ? "approved" : "draft"}`}
                >
                  {template.active ? "Đang chạy" : "Tạm dừng"}
                </span>
                <small>Phiên bản {template.version}</small>
              </div>
              <h4>{template.title}</h4>
              <p>
                {template.cadence === "daily"
                  ? "Mỗi ngày"
                  : template.cadence === "weekly"
                    ? "Mỗi tuần"
                    : "Mỗi tháng"}{" "}
                · {template.checklist.length} bước
              </p>
              <p>
                Lần sinh tiếp theo:{" "}
                <strong>{formatTaskDate(template.nextRun)}</strong>
              </p>
              {template.lastError ? (
                <p role="alert">{template.lastError}</p>
              ) : null}
              <button
                className="secondary-action"
                onClick={() => {
                  setEditing(template.id);
                  setForm({
                    title: template.title,
                    assigneeId: String(template.assigneeId),
                    reviewerId: String(template.reviewerId ?? ""),
                    cadence: template.cadence,
                    startDate: template.anchorDate,
                    priority: template.priority,
                    checklistText: template.checklist.join("\n"),
                    active: template.active,
                  });
                  setShowForm(true);
                }}
              >
                Sửa mẫu / Tạm dừng
              </button>
            </article>
          ))}
          {!loading && !templates.length ? (
            <div className="panel-card workflow-empty">
              Chưa có mẫu định kỳ. Mỗi lần sinh sẽ tạo checklist riêng, giữ
              nguyên dữ liệu cũ.
            </div>
          ) : null}
          <button
            className="secondary-action"
            disabled={loading}
            onClick={async () => {
              const result = await runAction(
                () => api.post<{ generated: number }>("/work/generate", {}),
                (value) => ({
                  title: `Đã sinh ${value.generated} công việc đến lịch`,
                }),
              );
              if (result.ok) setRefresh((value) => value + 1);
            }}
          >
            Kiểm tra lịch và sinh việc đến hạn
          </button>
        </div>
      ) : null}
      {enabled && tab === "activity" ? (
        <section className="panel-card workflow-audit">
          {audit.map((event) => (
            <article key={event.id}>
              <span className="workflow-audit-dot" />
              <div className="workflow-audit-content">
                <header className="workflow-audit-heading">
                  <div>
                    <strong>{event.actorName}</strong>{" "}
                    <span className="workflow-state">
                      {auditActions[event.action] ?? event.action}
                    </span>
                  </div>
                  <time>
                    {new Date(event.createdAt).toLocaleString(
                      locale === "en" ? "en-US" : "vi-VN",
                    )}
                  </time>
                </header>
                <p>
                  <span>{locale === "en" ? "Task:" : "Công việc:"}</span>{" "}
                  <strong>{event.summary || (locale === "en" ? "Untitled task" : "Công việc không tên")}</strong>
                </p>
                <details>
                  <summary>Xem thay đổi</summary>
                  {(() => {
                    const before = auditRecord(event.beforeData);
                    const after = auditRecord(event.afterData);
                    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
                      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
                    return keys.length ? (
                      <ul className="workflow-audit-changes">
                        {keys.map((key) => (
                          <li key={key}>
                            <strong>{auditFields[key] ?? key}</strong>
                            <span>
                              {auditValue(key, before[key], locale)}{" "}
                              <span aria-label={locale === "en" ? "changed to" : "thành"}>→</span>{" "}
                              <b>{auditValue(key, after[key], locale)}</b>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="workflow-audit-no-changes">
                        {locale === "en" ? "No field details were recorded." : "Không có chi tiết trường dữ liệu được ghi lại."}
                      </p>
                    );
                  })()}
                </details>
              </div>
            </article>
          ))}
          {!loading && !audit.length ? (
            <div className="workflow-empty">
              Chưa có hoạt động trong phạm vi của bạn.
            </div>
          ) : null}
        </section>
      ) : null}
      {loading ? <p role="status">Đang tải dữ liệu…</p> : null}
      {enabled && tab !== "templates" ? (
        <div className="workflow-pagination">
          <button
            className="secondary-action"
            disabled={page === 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            Trang trước
          </button>
          <span>
            Trang {page} / {Math.max(1, Math.ceil(total / 25))}
          </span>
          <button
            className="secondary-action"
            disabled={page * 25 >= total || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Trang sau
          </button>
        </div>
      ) : null}
      {selectedTask ? (
        <div className="task-detail-backdrop" onClick={() => setSelected(null)}>
          <section
            className="task-detail-page"
            role="dialog"
            aria-modal="true"
            aria-label="Chi tiết duyệt việc"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header">
              <h3>{selectedTask.title}</h3>
              <button
                className="secondary-action"
                onClick={() => setSelected(null)}
              >
                Đóng
              </button>
            </div>
            <p>
              {selectedTask.assignee} ·{" "}
              {formatTaskDate(selectedTask.dueDate ?? selectedTask.time)} ·{" "}
              {selectedTask.progress}%
            </p>
            <TaskWorkflowPanel task={selectedTask} readOnly={tab === "trash"} />
            {tab !== "trash" ? <TaskDependenciesPanel taskId={selectedTask.id} revision={`${selectedTask.status}:${selectedTask.progress}:${selectedTask.locked}`} /> : null}
            {tab !== "trash" ? <TaskCoordinationPanel taskId={selectedTask.id} revision={`${selectedTask.status}:${selectedTask.progress}:${selectedTask.locked}`} /> : null}
            {tab !== "trash" ? <TaskCollaborationPanel taskId={selectedTask.id} revision={`${selectedTask.status}:${selectedTask.progress}:${selectedTask.locked}`} /> : null}
            {selectedTask.checklist?.map((item) => (
              <p key={item.id}>
                {item.completed ? "✓" : "○"} {item.title}
              </p>
            ))}
            {manage &&
            !selectedTask.locked &&
            (selectedTask.createdById === user?.id || user?.role === "admin") &&
            tab !== "trash" ? (
              <div className="workflow-inline-actions">
                <label>
                  Người duyệt
                  <select
                    className="soft-select"
                    value={reviewer}
                    onChange={(event) => setReviewer(event.target.value)}
                  >
                    <option value="">Không yêu cầu duyệt</option>
                    {lookups.reviewers
                      .filter((person) => person.id !== selectedTask.assigneeId && (person.role === "admin" || (person.departmentId != null && person.departmentId === selectedTask.departmentId)))
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  className="secondary-action"
                  onClick={async () => {
                    const result = await runAction(
                      () =>
                        api.post<TaskItem>(
                          `/work/tasks/${selectedTask.id}/reviewer`,
                          reviewer ? { reviewerId: Number(reviewer) } : {},
                        ),
                      { title: "Đã cập nhật người duyệt" },
                    );
                    if (result.ok) {
                      setSelected({
                        ...result.value,
                        id: String(result.value.id),
                      });
                      await refreshTask(String(result.value.id));
                      setRefresh((value) => value + 1);
                    }
                  }}
                >
                  Lưu người duyệt
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
      {showForm ? (
        <div className="modal-backdrop">
          <section
            className="task-modal workflow-template-form"
            role="dialog"
            aria-modal="true"
            aria-label="Mẫu công việc định kỳ"
          >
            <div className="section-header">
              <h3>{editing ? "Lưu phiên bản mẫu mới" : "Tạo mẫu định kỳ"}</h3>
              <button
                className="secondary-action"
                onClick={() => setShowForm(false)}
              >
                Đóng
              </button>
            </div>
            <form className="task-form" onSubmit={saveTemplate}>
              <label>
                Tên mẫu
                <input
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Người thực hiện
                <select
                  required
                  value={form.assigneeId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assigneeId: event.target.value,
                      reviewerId: "",
                    }))
                  }
                >
                  <option value="">Chọn nhân sự</option>
                  {lookups.assignees.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Người duyệt
                <select
                  value={form.reviewerId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reviewerId: event.target.value,
                    }))
                  }
                >
                  <option value="">Không yêu cầu duyệt</option>
                  {lookups.reviewers
                    .filter((person) => String(person.id) !== form.assigneeId && (person.role === "admin" || (person.departmentId != null && person.departmentId === lookups.assignees.find(item => String(item.id) === form.assigneeId)?.departmentId)))
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="task-form-row">
                <label>
                  Chu kỳ
                  <select
                    value={form.cadence}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cadence: event.target.value,
                      }))
                    }
                  >
                    <option value="daily">Hằng ngày</option>
                    <option value="weekly">Hằng tuần</option>
                    <option value="monthly">Hằng tháng</option>
                  </select>
                </label>
                <label>
                  Ngày bắt đầu
                  <input
                    required
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Ưu tiên
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                </select>
              </label>
              <label>
                Các bước checklist
                <textarea
                  rows={5}
                  value={form.checklistText}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      checklistText: event.target.value,
                    }))
                  }
                  placeholder="Mỗi dòng một bước kiểm tra"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                />{" "}
                Bật lịch tự sinh việc
              </label>
              <p>
                Sửa mẫu tạo phiên bản mới; công việc đã sinh không bị thay đổi.
              </p>
              <button className="primary-action" disabled={saving}>
                {saving ? "Đang lưu…" : "Lưu mẫu"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
