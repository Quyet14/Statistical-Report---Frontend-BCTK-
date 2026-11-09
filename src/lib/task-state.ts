import type { TaskStatus } from "@/types";
export function persistedTaskState(task: {
  status?: unknown;
  progress?: unknown;
  reviewerId?: unknown;
  approvalState?: unknown;
}): { status: TaskStatus; progress: number } {
  const number = Number(task.progress);
  const progress = Number.isFinite(number)
    ? Math.max(0, Math.min(100, Math.round(number)))
    : 0;
  if (task.reviewerId && task.approvalState !== "approved" && progress === 100)
    return { status: "doing", progress };
  if (task.status === "done" || progress === 100)
    return { status: "done", progress: 100 };
  if (task.status === "doing") return { status: "doing", progress };
  if (task.status === "todo" || progress === 0)
    return { status: "todo", progress: 0 };
  return { status: "doing", progress };
}
