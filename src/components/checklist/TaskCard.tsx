"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { UserOutlined, ApartmentOutlined, CalendarOutlined, PlusOutlined, RightOutlined } from "@ant-design/icons";
import { formatTaskDate, priorityLabels } from "@/lib/presentation";

type TaskCardProps = {
  id: string;
  title: string;
  assignee: string;
  time: string;
  status: "todo" | "doing" | "done";
  progress: number;
  priority?: "Low" | "Medium" | "High";
  extra?: ReactNode;
  onToggleComplete?: (id: string, nextStatus: "todo" | "doing" | "done") => void;
  onUpdate?: (id: string, update: { title: string; assignee: string; time: string; status: "todo" | "doing" | "done"; priority: "Low" | "Medium" | "High"; progress: number }) => void | Promise<boolean>;
  onDelete?: (id: string) => void | Promise<boolean>;
  checklist?: { id: number; title: string; completed: boolean }[];
  onToggleChecklist?: (taskId: string, itemId: number, completed: boolean) => void;
  onAddChecklist?: (taskId: string, title: string) => void | Promise<boolean>;
  department?: string;
};

const statusLabel = {
  todo: "CHỜ",
  doing: "ĐANG LÀM",
  done: "HOÀN THÀNH",
};

export function TaskCard({
  id,
  title,
  assignee,
  time,
  status,
  progress,
  priority = "Medium",
  extra,
  onToggleComplete,
  onUpdate,
  onDelete,
  checklist = [],
  onToggleChecklist,
  onAddChecklist,
  department,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftAssignee, setDraftAssignee] = useState(assignee);
  const [draftTime, setDraftTime] = useState(time);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftPriority, setDraftPriority] = useState(priority);
  const [draftProgress, setDraftProgress] = useState(progress);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [pending, setPending] = useState<"save" | "add" | "delete" | null>(null);

  const saveTitle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !draftTitle.trim()) return;
    setPending("save");
    const saved = await onUpdate?.(id, {
      title: draftTitle.trim(),
      assignee: draftAssignee.trim(),
      time: draftTime,
      status: draftStatus,
      priority: draftPriority,
      progress: draftProgress,
    });
    setPending(null);
    if (saved !== false) setIsEditing(false);
  };

  const addChecklist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !newChecklistTitle.trim()) return;
    setPending("add");
    const saved = await onAddChecklist?.(id, newChecklistTitle.trim());
    setPending(null);
    if (saved !== false) setNewChecklistTitle("");
  };

  return (
    <article className={`task-card task-status-${status}`}>
      {extra ? <div className="task-extra">{extra}</div> : null}

      <div className="task-card-body">
        <input
          type="checkbox"
          checked={status === "done"}
          onChange={() =>
            onToggleComplete?.(id, status === "done" ? "todo" : "done")
          }
          className="task-checkbox"
          aria-label={`Đánh dấu hoàn thành: ${title}`}
        />

        <div className="task-card-content">
          <div className="task-card-header">
            <h4 className="task-title">{title}</h4>
            <span className={`task-tag status-${status}`}>{statusLabel[status]}</span>
          </div>

          <div className="task-meta">
            <span className="task-meta-person"><UserOutlined aria-hidden="true" />{assignee}</span>
            <span className="task-meta-department"><ApartmentOutlined aria-hidden="true" />{department ?? "Chưa có phòng ban"}</span>
          </div>
          <div className="task-schedule">
            <span className="task-due-date"><CalendarOutlined aria-hidden="true" /><time dateTime={time.match(/^\d{4}-\d{2}-\d{2}/)?.[0]}>{formatTaskDate(time)}</time></span>
            <span className={`priority-tag priority-${priority.toLowerCase()}`}>{priorityLabels[priority]}</span>
          </div>
          <div className="task-progress-row">
            <span>Tiến độ</span>
            <strong>{progress}%</strong>
          </div>
          <div className="progress-track" role="progressbar" aria-label={`Tiến độ ${title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} className={`progress-bar ${status}`} />
          </div>

          {checklist.length > 0 ? (
            <div className="task-checklist">
              {checklist.map((item) => (
                <label key={item.id} className="task-checklist-item">
                  <input type="checkbox" checked={item.completed} onChange={(event) => onToggleChecklist?.(id, item.id, event.target.checked)} />
                  <span>{item.title}</span>
                </label>
              ))}
            </div>
          ) : null}

          {onAddChecklist ? <details className="task-add-details">
            <summary><PlusOutlined aria-hidden="true" /><span>Thêm mục công việc</span><RightOutlined className="task-add-chevron" aria-hidden="true" /></summary>
            <form className="task-checklist-add" onSubmit={addChecklist}>
              <input value={newChecklistTitle} onChange={(event) => setNewChecklistTitle(event.target.value)} placeholder="Nhập nội dung..." aria-label="Nội dung mục công việc mới" required />
              <button type="submit" className="mini-action edit" disabled={pending === "add"}>{pending === "add" ? "Đang lưu..." : "Thêm"}</button>
            </form>
          </details> : null}

          <div className="task-actions">
            {onUpdate ? <button type="button" className="mini-action edit" onClick={() => { setDraftTitle(title); setDraftAssignee(assignee); setDraftTime(time); setDraftStatus(status); setDraftPriority(priority); setDraftProgress(progress); setIsEditing(true); }}>
              Sửa
            </button> : null}
            {onDelete ? <button type="button" className="mini-action delete" onClick={() => setIsConfirmingDelete(true)}>
              Xóa
            </button> : null}
          </div>
        </div>
      </div>

      {isEditing && typeof document !== "undefined" ? createPortal((
        <div className="task-edit-panel">
          <div className="task-edit-dialog" role="dialog" aria-modal="true" aria-labelledby={`task-edit-title-${id}`}>
            <div className="task-edit-header">
              <div>
                <span className="eyebrow">Cập nhật thông tin</span>
                <h3 id={`task-edit-title-${id}`}>Chỉnh sửa task</h3>
              </div>
              <button type="button" className="close-button" onClick={() => setIsEditing(false)} aria-label="Đóng cửa sổ chỉnh sửa">×</button>
            </div>
            <form onSubmit={saveTitle}>
              <label htmlFor={`task-title-${id}`}>Tiêu đề task</label>
              <input id={`task-title-${id}`} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} autoFocus />
              <label htmlFor={`task-assignee-${id}`}>Người phụ trách</label>
              <input id={`task-assignee-${id}`} value={draftAssignee} onChange={(event) => setDraftAssignee(event.target.value)} />
              <div className="task-form-row">
                <label htmlFor={`task-time-${id}`}>Hạn chót<input id={`task-time-${id}`} type="date" value={draftTime.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ""} onChange={(event) => setDraftTime(event.target.value)} /></label>
                <label htmlFor={`task-status-${id}`}>Trạng thái<select id={`task-status-${id}`} value={draftStatus} onChange={(event) => setDraftStatus(event.target.value as typeof draftStatus)}>
                  <option value="todo">Chưa bắt đầu</option>
                  <option value="doing">Đang làm</option>
                  <option value="done">Hoàn thành</option>
                </select></label>
              </div>
              <div className="task-form-row">
                <label htmlFor={`task-priority-${id}`}>Mức độ ưu tiên<select id={`task-priority-${id}`} value={draftPriority} onChange={(event) => setDraftPriority(event.target.value as typeof draftPriority)}>
                  <option value="Low">Thấp</option>
                  <option value="Medium">Trung bình</option>
                  <option value="High">Cao</option>
                </select></label>
                <label htmlFor={`task-progress-${id}`}>Tiến độ: {draftProgress}%<input id={`task-progress-${id}`} type="range" min="0" max="100" value={draftProgress} onChange={(event) => setDraftProgress(Number(event.target.value))} /></label>
              </div>
              <div className="task-edit-actions">
                <button type="button" className="secondary-action" onClick={() => setIsEditing(false)}>Hủy</button>
                <button type="submit" className="primary-action" disabled={pending === "save"}>{pending === "save" ? "Đang lưu..." : "Lưu thay đổi"}</button>
              </div>
            </form>
          </div>
        </div>
      ), document.body) : null}

      {isConfirmingDelete && typeof document !== "undefined" ? createPortal((
        <div className="modal-backdrop" onClick={() => setIsConfirmingDelete(false)}>
          <div className="task-modal settings-confirm" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={`task-delete-title-${id}`}>
            <h3 id={`task-delete-title-${id}`}>Xác nhận xoá task</h3>
            <p>Bạn có chắc muốn xoá <strong>{title}</strong>? Thao tác này sẽ xoá task khỏi danh sách hiện tại.</p>
            <div className="task-modal-actions">
              <button type="button" className="secondary-action" onClick={() => setIsConfirmingDelete(false)}>Huỷ</button>
              <button type="button" className="danger-action" disabled={pending === "delete"} onClick={async () => {
                if (pending) return;
                setPending("delete");
                const deleted = await onDelete?.(id);
                setPending(null);
                if (deleted !== false) setIsConfirmingDelete(false);
              }}>{pending === "delete" ? "Đang xóa..." : "Xóa công việc"}</button>
            </div>
          </div>
        </div>
      ), document.body) : null}
    </article>
  );
}
