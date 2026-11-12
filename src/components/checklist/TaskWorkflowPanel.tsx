"use client";
import { useState } from "react";
import type { TaskItem } from "@/types";
import { getStoredUser } from "@/lib/auth";
import { useTasks } from "@/context/TaskContext";
import { useLocale } from "@/i18n/locale-provider";
export function TaskWorkflowPanel({
  task,
  readOnly = false,
}: {
  task: TaskItem;
  readOnly?: boolean;
}) {
  const { reviewTask } = useTasks();
  const { t } = useLocale();
  const user = getStoredUser();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!task.reviewerId) return null;
  const isReadOnly = readOnly || user?.role === "viewer";
  const currentStep = task.approvalSteps?.findIndex(step => step.reviewerId === task.reviewerId && step.state !== "approved") ?? -1;
  const hasNextStep = currentStep >= 0 && currentStep < (task.approvalSteps?.length ?? 0) - 1;
  const labels = {
    draft: t("workflow.draft"),
    submitted: t("workflow.submitted"),
    approved: t("workflow.approved"),
    rejected: t("workflow.rejected"),
  };
  async function act(action: "submit" | "approve" | "reject" | "reopen") {
    if (busy) return;
    setBusy(true);
    try {
      await reviewTask(task.id, action, reason);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`task-workflow-state ${task.approvalState ?? "draft"}`}>
      <strong>{labels[task.approvalState ?? "draft"]}</strong>
      {task.delegatedReview ? <p>{t("workflow.delegated")}</p> : null}
      {task.isParticipant ? <p>{t("workflow.participant")}</p> : null}
      {task.approvalSteps?.length ? <ol className="task-approval-summary">{task.approvalSteps.map(step=><li key={step.position}>{t("workflow.level")} {step.position} · {step.reviewerName??`Tài khoản #${step.reviewerId}`} · {step.state==="approved"?t("workflow.approvedShort"):step.state==="rejected"?t("workflow.needsChanges"):t("workflow.awaitingReview")}</li>)}</ol> : null}
      {task.rejectionReason ? <p>Lý do: {task.rejectionReason}</p> : null}
      {!isReadOnly && task.assigneeId === user?.id && task.progress === 100 && !task.locked ? (
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() => void act("submit")}
        >
          Gửi duyệt
        </button>
      ) : null}
      {!isReadOnly && !task.isParticipant && (task.reviewerId === user?.id || task.canReview) &&
      task.assigneeId !== user?.id &&
      task.approvalState === "submitted" ? (
        <div className="workflow-inline-actions">
          <label>
            {t("workflow.reason")}
            <input
              className="auth-input"
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("workflow.additionalContent")}
            />
          </label>
          <button
            type="button"
            className="primary-action"
            disabled={busy}
            onClick={() => void act("approve")}
          >
            {hasNextStep ? `${t("workflow.approveLevel")} ${currentStep + 1}` : t("workflow.approveComplete")}
          </button>
          <button
            type="button"
            className="danger-action"
            disabled={busy || reason.trim().length < 3}
            onClick={() => void act("reject")}
          >
            {t("workflow.reject")}
          </button>
        </div>
      ) : null}
      {!isReadOnly && task.locked &&
      (user?.role === "admin" || task.reviewerId === user?.id) ? (
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() => void act("reopen")}
        >
          {t("workflow.reopen")}
        </button>
      ) : null}
    </div>
  );
}
