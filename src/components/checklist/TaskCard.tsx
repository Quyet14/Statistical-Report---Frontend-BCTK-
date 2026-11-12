"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  UserOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  PlusOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { formatTaskDate, priorityLabels } from "@/lib/presentation";
import { TaskEvidencePanel } from "./TaskEvidencePanel";
import { TaskDependenciesPanel } from "./TaskDependenciesPanel";
import { TaskCoordinationPanel } from "./TaskCoordinationPanel";
import { TaskCollaborationPanel } from "./TaskCollaborationPanel";
import { useLocale } from "@/i18n/locale-provider";

type TaskCardProps = {
  id: string;
  title: string;
  titleEn?: string | null;
  assignee: string;
  time: string;
  status: "todo" | "doing" | "done";
  progress: number;
  locked?: boolean;
  priority?: "Low" | "Medium" | "High";
  extra?: ReactNode;
  onToggleComplete?: (
    id: string,
    nextStatus: "todo" | "doing" | "done",
  ) => void;
  onUpdate?: (
    id: string,
    update: {
      title: string;
      titleEn?: string;
      assignee: string;
      time: string;
      status: "todo" | "doing" | "done";
      priority: "Low" | "Medium" | "High";
      progress: number;
    },
  ) => void | Promise<boolean>;
  onDelete?: (id: string) => void | Promise<boolean>;
  checklist?: {
    id: number;
    title: string;
    titleEn?: string | null;
    completed: boolean;
    fieldType?: "tick" | "number" | "signature";
    numberValue?: number | null;
    signedById?: number | null;
    outcome?: "pending" | "pass" | "fail" | "na";
  }[];
  onToggleChecklist?: (
    taskId: string,
    itemId: number,
    completed: boolean,
  ) => void;
  onAddChecklist?: (taskId: string, title: string, titleEn?: string) => void | Promise<boolean>;
  onReportFailure?: (taskId: string, itemId: number) => void;
  department?: string;
};

export function TaskCard({
  id,
  title,
  titleEn,
  assignee,
  time,
  status,
  progress,
  locked = false,
  priority = "Medium",
  extra,
  onToggleComplete,
  onUpdate,
  onDelete,
  checklist = [],
  onToggleChecklist,
  onAddChecklist,
  onReportFailure,
  department,
}: TaskCardProps) {
  const { locale, t } = useLocale();
  const displayTitle = locale === "en" && titleEn?.trim() ? titleEn : title;
  const statusLabel = {
    todo: t("taskCard.todo").toUpperCase(),
    doing: t("taskCard.doing").toUpperCase(),
    done: t("taskCard.completed"),
  };
  const currentPriorityLabels = {
    Low: t("taskCard.priorityLow"),
    Medium: t("taskCard.priorityMedium"),
    High: t("taskCard.priorityHigh"),
  };
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftTitleEn, setDraftTitleEn] = useState(titleEn ?? "");
  const [draftAssignee, setDraftAssignee] = useState(assignee);
  const [draftTime, setDraftTime] = useState(time);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftPriority, setDraftPriority] = useState(priority);
  const [draftProgress, setDraftProgress] = useState(progress);
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newChecklistTitleEn, setNewChecklistTitleEn] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [pending, setPending] = useState<"save" | "add" | "delete" | null>(
    null,
  );

  const saveTitle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !draftTitle.trim()) return;
    setPending("save");
    const saved = await onUpdate?.(id, {
      title: draftTitle.trim(),
      titleEn: draftTitleEn.trim(),
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
    const saved = await onAddChecklist?.(id, newChecklistTitle.trim(), newChecklistTitleEn.trim());
    setPending(null);
    if (saved !== false) {
      setNewChecklistTitle("");
      setNewChecklistTitleEn("");
    }
  };

  return (
    <article className={`task-card task-status-${status}`}>
      {extra ? <div className="task-extra">{extra}</div> : null}

      <div className="task-card-body">
        <input
          type="checkbox"
          checked={status === "done"}
          disabled={locked || !onToggleComplete}
          onChange={() =>
            onToggleComplete?.(id, status === "done" ? "todo" : "done")
          }
          className="task-checkbox"
          aria-label={`${locale === "en" ? "Mark complete" : "Đánh dấu hoàn thành"}: ${displayTitle}`}
        />

        <div className="task-card-content">
          <div className="task-card-header">
            <h4 className="task-title" data-i18n-skip>
              {displayTitle}
            </h4>
            <span className={`task-tag status-${status}`}>
              {statusLabel[status]}
            </span>
          </div>

          <div className="task-meta">
            <span className="task-meta-person">
              <UserOutlined aria-hidden="true" />
              {assignee}
            </span>
            <span className="task-meta-department">
              <ApartmentOutlined aria-hidden="true" />
              {department ?? "Chưa có phòng ban"}
            </span>
          </div>
          <div className="task-schedule">
            <span className="task-due-date">
              <CalendarOutlined aria-hidden="true" />
              <time dateTime={time.match(/^\d{4}-\d{2}-\d{2}/)?.[0]}>
                {formatTaskDate(time)}
              </time>
            </span>
            <span className={`priority-tag priority-${priority.toLowerCase()}`}>
              {locale === "en" ? currentPriorityLabels[priority] : priorityLabels[priority]}
            </span>
          </div>
          <div className="task-progress-row">
            <span>{t("taskCard.progress")}</span>
            <strong>{progress}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label={`Tiến độ ${displayTitle}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span
              style={{ width: `${progress}%` }}
              className={`progress-bar ${status}`}
            />
          </div>

          {checklist.length > 0 ? (
            <div className="task-checklist">
              {checklist.map((item) => (
                <div key={item.id} className="task-checklist-item-wrap">
                  <label className="task-checklist-item">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={locked || !onToggleChecklist || (item.fieldType??"tick")!=="tick" || item.outcome==="fail"}
                      onChange={(event) =>
                        onToggleChecklist?.(id, item.id, event.target.checked)
                      }
                    />
                    <span>
                      <span data-i18n-skip>
                        {locale === "en" && item.titleEn?.trim()
                          ? item.titleEn
                          : item.title}
                      </span>
                      {item.fieldType === "number" ? <small> · {item.numberValue == null ? t("taskCard.numberRequired") : `${t("taskCard.value")}: ${item.numberValue}`}</small> : null}
                      {item.fieldType === "signature" ? <small> · {item.signedById ? `${t("taskCard.acknowledgedBy")} #${item.signedById}` : t("taskCard.needsSignature")}</small> : null}
                      {item.outcome === "fail" ? (
                        <strong className="task-checklist-failed">
                          {" "}
                          · {t("taskCard.failed")}
                        </strong>
                      ) : null}
                    </span>
                  </label>
                  {!locked && item.outcome !== "fail" && onReportFailure ? (
                    <button
                      type="button"
                      className="task-checklist-failure"
                      onClick={() => onReportFailure(id, item.id)}
                    >
                      {t("taskCard.reportFailure")}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <TaskEvidencePanel
            taskId={id}
            canUpload={
              !locked &&
              (!!onUpdate || !!onToggleChecklist || !!onAddChecklist)
            }
          />
          <TaskDependenciesPanel taskId={id} revision={`${status}:${progress}:${locked}`} />
          <TaskCoordinationPanel taskId={id} revision={`${status}:${progress}:${locked}`} />
          <TaskCollaborationPanel taskId={id} revision={`${status}:${progress}:${locked}`} />

          {onAddChecklist ? (
            <details className="task-add-details">
              <summary>
                <PlusOutlined aria-hidden="true" />
                <span>{t("taskCard.addChecklistItem")}</span>
                <RightOutlined
                  className="task-add-chevron"
                  aria-hidden="true"
                />
              </summary>
              <form className="task-checklist-add" onSubmit={addChecklist}>
                <input
                  value={newChecklistTitle}
                  onChange={(event) => setNewChecklistTitle(event.target.value)}
                  placeholder={t("taskCard.enterContent")}
                  aria-label={t("taskCard.newItemLabel")}
                  required
                />
                <input
                  value={newChecklistTitleEn}
                  onChange={(event) => setNewChecklistTitleEn(event.target.value)}
                  placeholder="English checklist item (optional)"
                  aria-label="English checklist item"
                  maxLength={255}
                />
                <button
                  type="submit"
                  className="mini-action edit"
                  disabled={pending === "add"}
                >
                  {pending === "add" ? t("taskCard.saving") : t("taskCard.add")}
                </button>
              </form>
            </details>
          ) : null}

          <div className="task-actions">
            {onUpdate ? (
              <button
                type="button"
                className="mini-action edit"
                onClick={() => {
                  setDraftTitle(title);
                  setDraftTitleEn(titleEn ?? "");
                  setDraftAssignee(assignee);
                  setDraftTime(time);
                  setDraftStatus(status);
                  setDraftPriority(priority);
                  setDraftProgress(progress);
                  setIsEditing(true);
                }}
              >
                {t("taskCard.edit")}
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className="mini-action delete"
                onClick={() => setIsConfirmingDelete(true)}
              >
                {t("taskCard.delete")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isEditing && typeof document !== "undefined"
        ? createPortal(
            <div className="task-edit-panel">
              <div
                className="task-edit-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`task-edit-title-${id}`}
              >
                <div className="task-edit-header">
                  <div>
                    <span className="eyebrow">{t("taskCard.updateInfo")}</span>
                    <h3 id={`task-edit-title-${id}`}>{t("taskCard.editTask")}</h3>
                  </div>
                  <button
                    type="button"
                    className="close-button"
                    onClick={() => setIsEditing(false)}
                    aria-label={t("taskCard.closeEdit")}
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={saveTitle}>
                  <label htmlFor={`task-title-${id}`}>{t("taskCard.title")}</label>
                  <input
                    id={`task-title-${id}`}
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    autoFocus
                  />
                  <label htmlFor={`task-title-en-${id}`}>English title (optional)</label>
                  <input
                    id={`task-title-en-${id}`}
                    value={draftTitleEn}
                    maxLength={255}
                    onChange={(event) => setDraftTitleEn(event.target.value)}
                  />
                  <label htmlFor={`task-assignee-${id}`}>{t("taskCard.assignee")}</label>
                  <input
                    id={`task-assignee-${id}`}
                    value={draftAssignee}
                    readOnly
                    title={t("taskCard.assignmentHelp")}
                  />
                  <div className="task-form-row">
                    <label htmlFor={`task-time-${id}`}>
                      {t("taskCard.dueDate")}
                      <input
                        id={`task-time-${id}`}
                        type="date"
                        value={draftTime.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ""}
                        onChange={(event) => setDraftTime(event.target.value)}
                      />
                    </label>
                    <label htmlFor={`task-status-${id}`}>
                      {t("taskCard.status")}
                      <select
                        id={`task-status-${id}`}
                        value={draftStatus}
                        onChange={(event) =>
                          setDraftStatus(
                            event.target.value as typeof draftStatus,
                          )
                        }
                      >
                        <option value="todo">{t("taskCard.todo")}</option>
                        <option value="doing">{t("taskCard.doing")}</option>
                        <option value="done">{t("taskCard.done")}</option>
                      </select>
                    </label>
                  </div>
                  <div className="task-form-row">
                    <label htmlFor={`task-priority-${id}`}>
                      {t("taskCard.priority")}
                      <select
                        id={`task-priority-${id}`}
                        value={draftPriority}
                        onChange={(event) =>
                          setDraftPriority(
                            event.target.value as typeof draftPriority,
                          )
                        }
                      >
                        <option value="Low">{t("taskCard.low")}</option>
                        <option value="Medium">{t("taskCard.medium")}</option>
                        <option value="High">{t("taskCard.high")}</option>
                      </select>
                    </label>
                    <label htmlFor={`task-progress-${id}`}>
                      {t("taskCard.progress")}: {draftProgress}%
                      <input
                        id={`task-progress-${id}`}
                        type="range"
                        min="0"
                        max="100"
                        value={draftProgress}
                        onChange={(event) =>
                          setDraftProgress(Number(event.target.value))
                        }
                      />
                    </label>
                  </div>
                  <div className="task-edit-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setIsEditing(false)}
                    >
                      {t("taskCard.cancel")}
                    </button>
                    <button
                      type="submit"
                      className="primary-action"
                      disabled={pending === "save"}
                    >
                      {pending === "save" ? t("taskCard.saving") : t("taskCard.saveChanges")}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isConfirmingDelete && typeof document !== "undefined"
        ? createPortal(
            <div
              className="modal-backdrop"
              onClick={() => setIsConfirmingDelete(false)}
            >
              <div
                className="task-modal settings-confirm"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`task-delete-title-${id}`}
              >
                <h3 id={`task-delete-title-${id}`}>{t("taskCard.confirmDelete")}</h3>
                <p>
                  {locale === "en" ? "Are you sure you want to delete" : "Bạn có chắc muốn xóa"} <strong>{displayTitle}</strong>? {locale === "en" ? "It will be removed from the current list." : "Thao tác này sẽ xóa công việc khỏi danh sách hiện tại."}
                </p>
                <div className="task-modal-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    {t("taskCard.cancel")}
                  </button>
                  <button
                    type="button"
                    className="danger-action"
                    disabled={pending === "delete"}
                    onClick={async () => {
                      if (pending) return;
                      setPending("delete");
                      const deleted = await onDelete?.(id);
                      setPending(null);
                      if (deleted !== false) setIsConfirmingDelete(false);
                    }}
                  >
                    {pending === "delete" ? t("taskCard.saving") : t("taskCard.deleteTask")}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </article>
  );
}
