"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { getStoredUser, type CurrentUser } from "@/lib/auth";
import type { TaskItem, TaskPriority, TaskStatus } from "@/types";
import { useFeedback } from "@/context/FeedbackContext";
import { taskOutcomeFeedback } from "@/lib/feedback";
import { persistedTaskState } from "@/lib/task-state";

export type TaskDraft = {
  title: string;
  titleEn?: string;
  assignee: string;
  assigneeId?: number;
  time: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  checklistTitles?: string[];
  checklistTitlesEn?: string[];
  reviewerId?: number;
};

type TaskContextValue = {
  tasks: TaskItem[];
  reviewTask: (
    id: string,
    action: "submit" | "approve" | "reject" | "reopen",
    reason?: string,
  ) => Promise<boolean>;
  refreshTask: (id: string) => Promise<void>;
  addTask: (task: TaskDraft) => Promise<boolean>;
  updateTask: (id: string, update: Partial<TaskDraft>) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  completeTask: (id: string) => Promise<boolean>;
  updateChecklistItem: (
    taskId: string,
    itemId: number,
    completed: boolean,
  ) => Promise<boolean>;
  addChecklistItem: (
    taskId: string,
    title: string,
    titleEn?: string,
  ) => Promise<boolean>;
};

type RawChecklistItem = {
  id: number;
  title: string;
  titleEn?: string | null;
  completed: boolean;
  outcome?: "pending" | "pass" | "fail" | "na";
};

type RawTask = {
  id: string | number;
  title: string;
  assignee?: string;
  assigneeId?: number;
  departmentId?: number | null;
  departmentName?: string | null;
  department?: string | null;
  createdById?: number;
  reviewerId?: number | null;
  canReview?: boolean;
  delegatedReview?: boolean;
  isParticipant?: boolean;
  approvalSteps?: TaskItem["approvalSteps"];
  approvalState?: TaskItem["approvalState"];
  rejectionReason?: string | null;
  locked?: boolean;
  time?: string;
  dueDate?: string;
  status?: TaskStatus;
  progress?: number;
  priority?: string;
  isRecurring?: boolean;
  checklist?: RawChecklistItem[];
  titleEn?: string | null;
};

const clampProgress = (value: unknown) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(Math.max(Math.round(numericValue), 0), 100);
};

const normalizeTaskState = (
  status: unknown,
  progress: unknown,
): { status: TaskStatus; progress: number } => {
  const normalizedStatus =
    status === "done" || status === "doing" || status === "todo"
      ? status
      : undefined;
  const normalizedProgress = clampProgress(progress);

  if (normalizedStatus === "done" || normalizedProgress >= 100)
    return { status: "done", progress: 100 };
  if (normalizedStatus === "todo" || normalizedProgress <= 0)
    return { status: "todo", progress: 0 };
  return { status: "doing", progress: normalizedProgress };
};

const normalizePriority = (value: unknown): TaskPriority => {
  const normalized = String(value ?? "medium").toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
};

const normalizeTask = (item: RawTask): TaskItem => {
  const state = persistedTaskState(item);

  return {
    id: String(item.id),
    title: item.title,
    titleEn: item.titleEn ?? undefined,
    assigneeId: item.assigneeId,
    departmentId: item.departmentId,
    departmentName: item.departmentName ?? item.department,
    createdById: item.createdById,
    reviewerId: item.reviewerId,
    canReview: item.canReview,
    delegatedReview: item.delegatedReview,
    isParticipant: item.isParticipant,
    approvalSteps: item.approvalSteps,
    approvalState: item.approvalState,
    rejectionReason: item.rejectionReason,
    locked: item.locked,
    assignee: item.assignee ?? "Chưa phân công",
    time: item.time ?? item.dueDate ?? "Chưa có thời gian",
    status: state.status,
    progress: state.progress,
    priority: normalizePriority(item.priority),
    checklist: Array.isArray(item.checklist) ? item.checklist : [],
    department: item.departmentName ?? item.department ?? undefined,
    dueDate: item.dueDate ?? item.time,
  };
};

const TaskContext = createContext<TaskContextValue | undefined>(undefined);

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const { runAction } = useFeedback();

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await api.get<RawTask[]>("/tasks");
        let user: CurrentUser | null = getStoredUser();
        if (user?.id && (user.departmentId == null || !user.departmentName)) {
          try {
            const profile = await api.get<
              Pick<CurrentUser, "departmentId" | "departmentName"> & {
                department?: string;
              }
            >(`/users/${user.id}`);
            user = { ...user, departmentId: profile.departmentId };
            user.departmentName = profile.departmentName ?? profile.department;
          } catch {
            // The task endpoint still enforces visibility when the profile is unavailable.
          }
        }
        const departmentHead = user?.role?.toLowerCase() === "manager";
        let departmentTasks = response;
        if (departmentHead) {
          const users =
            await api.get<
              Array<{ id: number; name: string; departmentId?: number | null }>
            >("/users");
          const profile = users.find((item) => item.id === user?.id);
          const departmentId = user?.departmentId ?? profile?.departmentId;
          const departmentUsers =
            departmentId == null
              ? new Set<number>()
              : new Set(
                  users
                    .filter(
                      (item) =>
                        Number(item.departmentId) === Number(departmentId),
                    )
                    .map((item) => item.id),
                );
          const departmentUserNames = new Set(
            users
              .filter((item) => departmentUsers.has(item.id))
              .map((item) => item.name.trim().toLowerCase()),
          );
          departmentTasks =
            departmentId == null
              ? []
              : response.filter((item) => {
                  if (item.assigneeId != null)
                    return departmentUsers.has(Number(item.assigneeId));
                  return departmentUserNames.has(
                    String(item.assignee ?? "")
                      .trim()
                      .toLowerCase(),
                  );
                });
        }
        setTasks(departmentTasks.map(normalizeTask));
      } catch (error) {
        console.warn(
          "Backend task API unavailable, using fallback data.",
          error,
        );
      }
    };

    void loadTasks();
  }, []);

  const addTask = async (task: TaskDraft) => {
    const checklistTitles = task.checklistTitles ?? [];
    const checklistTitlesEn = task.checklistTitlesEn ?? [];
    const checklist = checklistTitles
      .map((item) => item.trim())
      .filter(Boolean);
    const checklistEn = checklistTitles
      .map((item, index) => (item.trim() ? checklistTitlesEn[index]?.trim() ?? "" : null))
      .filter((item): item is string => item !== null);
    const payload = {
      title: task.title.trim(),
      ...(task.titleEn?.trim() ? { titleEn: task.titleEn.trim() } : {}),
      assigneeId: task.assigneeId,
      reviewerId: task.reviewerId,
      dueDate: task.time.match(/^\d{4}-\d{2}-\d{2}/)?.[0],
      priority: task.priority.toLowerCase(),
      isRecurring: false,
      status: task.status,
      progress: task.progress,
      checklist,
      ...(checklistEn.some(Boolean) ? { checklistEn } : {}),
    };

    const result = await runAction(() => api.post<RawTask>("/tasks", payload), {
      title: "Đã giao công việc",
      description: task.title.trim(),
    });
    if (!result.ok) return false;
    setTasks((currentTasks) => [normalizeTask(result.value), ...currentTasks]);
    return true;
  };

  const updateTask = async (id: string, update: Partial<TaskDraft>) => {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return false;
    const nextState = normalizeTaskState(
      update.status ?? currentTask.status,
      update.progress ?? currentTask.progress,
    );

    const nextTask = {
      ...currentTask,
      ...update,
      status: nextState.status,
      priority: update.priority ?? currentTask.priority,
      progress: nextState.progress,
      title: update.title ?? currentTask.title,
      titleEn: update.titleEn ?? currentTask.titleEn,
      assignee: update.assignee ?? currentTask.assignee,
      time: update.time ?? currentTask.time,
    };

    const payload = {
      title: nextTask.title,
      ...(update.titleEn !== undefined
        ? { titleEn: nextTask.titleEn?.trim() ?? "" }
        : {}),
      assigneeId: nextTask.assigneeId,
      dueDate: nextTask.time.match(/^\d{4}-\d{2}-\d{2}/)?.[0],
      priority: nextTask.priority.toLowerCase(),
      status: nextTask.status,
      progress: nextTask.progress,
    };

    const result = await runAction(
      () => api.patch<RawTask>(`/tasks/${id}`, payload),
      (persisted) =>
        persisted.approvalState === "submitted"
          ? {
              title: "Đã gửi công việc chờ duyệt",
              description: persisted.title,
            }
          : taskOutcomeFeedback(
              currentTask.status,
              persistedTaskState(persisted).status,
              persisted.title,
            ),
    );
    if (!result.ok) return false;
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? normalizeTask(result.value) : task,
      ),
    );
    return true;
  };
  const updateChecklistItem = async (
    taskId: string,
    itemId: number,
    completed: boolean,
  ) => {
    const result = await runAction(
      () =>
        api.patch<RawTask>(`/tasks/${taskId}/checklist/${itemId}`, {
          completed,
        }),
      (value) => ({
        title:
          value.approvalState === "submitted"
            ? "Đã gửi công việc chờ duyệt"
            : "Đã cập nhật checklist",
        description: value.title,
      }),
    );
    if (!result.ok) return false;
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? normalizeTask(result.value) : task,
      ),
    );
    return true;
  };
  const addChecklistItem = async (taskId: string, title: string, titleEn = "") => {
    const result = await runAction(
      () =>
        api.post<RawTask>(`/tasks/${taskId}/checklist`, {
          title: title.trim(),
          ...(titleEn.trim() ? { titleEn: titleEn.trim() } : {}),
        }),
      { title: "Đã thêm mục checklist" },
    );
    if (!result.ok) return false;
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? normalizeTask(result.value) : task,
      ),
    );
    return true;
  };
  const reviewTask = async (
    id: string,
    action: "submit" | "approve" | "reject" | "reopen",
    reason?: string,
  ) => {
    const result = await runAction(
      () =>
        api.post<RawTask>(`/work/tasks/${id}/review`, {
          action,
          ...(reason ? { reason } : {}),
        }),
      {
        title:
          action === "approve"
            ? "Đã duyệt hoàn thành"
            : action === "reject"
              ? "Đã trả lại công việc"
              : action === "reopen"
                ? "Đã mở khóa"
                : "Đã gửi duyệt",
      },
    );
    if (!result.ok) return false;
    setTasks((current) =>
      current.some((task) => task.id === id)
        ? current.map((task) =>
            task.id === id ? normalizeTask(result.value) : task,
          )
        : [normalizeTask(result.value), ...current],
    );
    return true;
  };

  const refreshTask = async (id: string) => {
    const value = await api.get<RawTask>(`/tasks/${id}`);
    setTasks((current) =>
      current.some((task) => task.id === id)
        ? current.map((task) => (task.id === id ? normalizeTask(value) : task))
        : [normalizeTask(value), ...current],
    );
  };

  const deleteTask = async (id: string) => {
    const currentTask = tasks.find((task) => task.id === id);
    const result = await runAction(() => api.del(`/tasks/${id}`), {
      title: "Đã xóa công việc",
      description: currentTask?.title,
      kind: "info",
    });
    if (!result.ok) return false;
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    return true;
  };

  const completeTask = async (id: string) => {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return false;

    const nextStatus = currentTask.status === "done" ? "todo" : "done";
    return updateTask(id, {
      status: nextStatus,
      progress: nextStatus === "done" ? 100 : 50,
    });
  };

  const value = useMemo<TaskContextValue>(
    () => ({
      tasks,
      reviewTask,
      refreshTask,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      updateChecklistItem,
      addChecklistItem,
    }),
    [tasks, runAction],
  );

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function useTasks() {
  const context = useContext(TaskContext);

  if (!context) {
    throw new Error("useTasks must be used within a TaskProvider");
  }

  return context;
}
