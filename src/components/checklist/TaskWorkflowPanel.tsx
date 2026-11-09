"use client";
import { useState } from "react";
import type { TaskItem } from "@/types";
import { getStoredUser } from "@/lib/auth";
import { useTasks } from "@/context/TaskContext";
export function TaskWorkflowPanel({
  task,
  readOnly = false,
}: {
  task: TaskItem;
  readOnly?: boolean;
}) {
  const { reviewTask } = useTasks();
  const user = getStoredUser();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!task.reviewerId) return null;
  const isReadOnly = readOnly || user?.role === "viewer";
  const currentStep = task.approvalSteps?.findIndex(step => step.reviewerId === task.reviewerId && step.state !== "approved") ?? -1;
  const hasNextStep = currentStep >= 0 && currentStep < (task.approvalSteps?.length ?? 0) - 1;
  const labels = {
    draft: "Cần người duyệt xác nhận",
    submitted: "Chờ duyệt · Đã khóa chỉnh sửa",
    approved: "Đã duyệt · Checklist đã khóa",
    rejected: "Bị từ chối · Cần bổ sung",
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
      {task.delegatedReview ? <p>Bạn đang duyệt theo ủy quyền còn hiệu lực. Nhật ký sẽ ghi người thực hiện duyệt thay.</p> : null}
      {task.isParticipant ? <p>Bạn đang phối hợp thực hiện; người phụ trách chính sẽ gửi duyệt.</p> : null}
      {task.approvalSteps?.length ? <ol className="task-approval-summary">{task.approvalSteps.map(step=><li key={step.position}>Cấp {step.position} · {step.reviewerName??`Tài khoản #${step.reviewerId}`} · {step.state==="approved"?"Đã duyệt":step.state==="rejected"?"Cần bổ sung":"Chờ duyệt"}</li>)}</ol> : null}
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
            Lý do nếu từ chối
            <input
              className="auth-input"
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nội dung cần bổ sung…"
            />
          </label>
          <button
            type="button"
            className="primary-action"
            disabled={busy}
            onClick={() => void act("approve")}
          >
            {hasNextStep ? `Duyệt cấp ${currentStep + 1}` : "Duyệt hoàn thành"}
          </button>
          <button
            type="button"
            className="danger-action"
            disabled={busy || reason.trim().length < 3}
            onClick={() => void act("reject")}
          >
            Từ chối
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
          Mở khóa để chỉnh sửa
        </button>
      ) : null}
    </div>
  );
}
