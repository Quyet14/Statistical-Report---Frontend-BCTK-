"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTasks } from "@/context/TaskContext";
import { getStoredUser } from "@/lib/auth";
import type { TaskItem } from "@/types";
import { TaskCard } from "./TaskCard";
import { TaskWorkflowPanel } from "./TaskWorkflowPanel";
export function TaskDetail({ id }: { id: string }) {
  const {
    tasks,
    refreshTask,
    updateTask,
    updateChecklistItem,
    addChecklistItem,
  } = useTasks();
  const [loaded, setLoaded] = useState<TaskItem | null>(null),
    [error, setError] = useState("");
  const user = getStoredUser();
  useEffect(() => {
    let alive = true;
    void api
      .get<TaskItem>(`/tasks/${id}`)
      .then((task) => {
        if (alive)
          setLoaded({
            ...task,
            id: String(task.id),
            priority:
              (
                { low: "Low", medium: "Medium", high: "High" } as Record<
                  string,
                  TaskItem["priority"]
                >
              )[String(task.priority).toLowerCase()] || "Medium",
          });
      })
      .catch((failure) => {
        if (alive)
          setError(
            failure instanceof Error
              ? failure.message
              : "Không tải được công việc.",
          );
      });
    return () => {
      alive = false;
    };
  }, [id]);
  const task = tasks.find((item) => item.id === id) || loaded;
  const readOnly = user?.role === "viewer" || task?.locked;
  return (
    <div className="dashboard-page handoff-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Thông tin công việc</span>
          <h1 className="page-title">Chi tiết công việc</h1>
        </div>
        <Link className="secondary-action" href="/workflow">
          Về danh sách
        </Link>
      </header>
      {error ? (
        <p className="workflow-alert" role="alert">
          {error}
        </p>
      ) : task ? (
        <TaskCard
          {...task}
          extra={<TaskWorkflowPanel task={task} />}
          onToggleComplete={
            readOnly
              ? undefined
              : (taskId, status) => {
                  void updateTask(taskId, {
                    status,
                    progress: status === "done" ? 100 : 0,
                  });
                }
          }
          onUpdate={readOnly ? undefined : updateTask}
          onToggleChecklist={
            readOnly
              ? undefined
              : (taskId, itemId, completed) => {
                  void updateChecklistItem(taskId, itemId, completed);
                }
          }
          onAddChecklist={readOnly ? undefined : addChecklistItem}
        />
      ) : (
        <p className="surface-card handoff-record" role="status">
          Đang tải…
        </p>
      )}
      <button
        className="secondary-action"
        type="button"
        onClick={() =>
          void refreshTask(id).catch((failure) => setError(failure.message))
        }
      >
        Tải lại công việc
      </button>
    </div>
  );
}
