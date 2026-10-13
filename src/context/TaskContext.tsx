"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { getStoredUser, type CurrentUser } from "@/lib/auth";
import type { TaskItem, TaskPriority, TaskStatus } from "@/types";

export type TaskDraft = {
  title: string;
  assignee: string;
  assigneeId?: number;
  time: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  checklistTitles?: string[];
};

type TaskContextValue = {
  tasks: TaskItem[];
  addTask: (task: TaskDraft) => Promise<void>;
  updateTask: (id: string, update: Partial<TaskDraft>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  updateChecklistItem: (taskId: string, itemId: number, completed: boolean) => Promise<void>;
  addChecklistItem: (taskId: string, title: string) => Promise<void>;
};

type RawChecklistItem = { id: number; title: string; completed: boolean };

type RawTask = {
  id: string | number;
  title: string;
  assignee?: string;
  assigneeId?: number;
  departmentId?: number | null;
  departmentName?: string | null;
  department?: string | null;
  createdById?: number;
  time?: string;
  dueDate?: string;
  status?: TaskStatus;
  progress?: number;
  priority?: string;
  isRecurring?: boolean;
  checklist?: RawChecklistItem[];
};

const userNameMap: Record<number, string> = {
  1: "Nguyễn Văn A",
  2: "Trần Thị B",
  3: "Lê Văn C",
};

const clampProgress = (value: unknown) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.min(Math.max(Math.round(numericValue), 0), 100);
};

const normalizeTaskState = (status: unknown, progress: unknown): { status: TaskStatus; progress: number } => {
  const normalizedStatus = status === "done" || status === "doing" || status === "todo" ? status : undefined;
  const normalizedProgress = clampProgress(progress);

  if (normalizedStatus === "done" || normalizedProgress >= 100) return { status: "done", progress: 100 };
  if (normalizedStatus === "todo" || normalizedProgress <= 0) return { status: "todo", progress: 0 };
  return { status: "doing", progress: normalizedProgress };
};

const normalizePriority = (value: unknown): TaskPriority => {
  const normalized = String(value ?? "medium").toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
};

const normalizeTask = (item: RawTask): TaskItem => {
  const state = normalizeTaskState(item.status ?? (item.isRecurring ? "todo" : "doing"), item.progress ?? (item.status === "done" ? 100 : 0));

  return {
    id: String(item.id),
    title: item.title,
    assigneeId: item.assigneeId,
    departmentId: item.departmentId,
    departmentName: item.departmentName ?? item.department,
    createdById: item.createdById,
    assignee: item.assignee ?? (item.assigneeId != null ? userNameMap[item.assigneeId] : undefined) ?? "Chưa phân công",
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

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await api.get<RawTask[]>("/tasks");
        let user: CurrentUser | null = getStoredUser();
        if (user?.id && (user.departmentId == null || !user.departmentName)) {
          try {
            const profile = await api.get<Pick<CurrentUser, "departmentId" | "departmentName"> & { department?: string }>(`/users/${user.id}`);
            user = { ...user, departmentId: profile.departmentId };
            user.departmentName = profile.departmentName ?? profile.department;
          } catch {
            // The task endpoint still enforces visibility when the profile is unavailable.
          }
        }
        const departmentHead = user?.role?.toLowerCase() === "manager";
        let departmentTasks = response;
        if (departmentHead) {
          const users = await api.get<Array<{ id: number; name: string; departmentId?: number | null }>>("/users");
          const profile = users.find((item) => item.id === user?.id);
          const departmentId = user?.departmentId ?? profile?.departmentId;
          const departmentUsers = departmentId == null
            ? new Set<number>()
            : new Set(users.filter((item) => Number(item.departmentId) === Number(departmentId)).map((item) => item.id));
          const departmentUserNames = new Set(
            users.filter((item) => departmentUsers.has(item.id)).map((item) => item.name.trim().toLowerCase()),
          );
          departmentTasks = departmentId == null
            ? []
            : response.filter((item) => {
              if (item.assigneeId != null) return departmentUsers.has(Number(item.assigneeId));
              return departmentUserNames.has(String(item.assignee ?? "").trim().toLowerCase());
            });
        }
        setTasks(departmentTasks.map(normalizeTask));
      } catch (error) {
        console.warn("Backend task API unavailable, using fallback data.", error);
      }
    };

    void loadTasks();
  }, []);

  const addTask = async (task: TaskDraft) => {
    const payload = {
      title: task.title.trim(),
      assigneeId: task.assigneeId ?? Number(Object.keys(userNameMap).find((key) => userNameMap[Number(key)] === task.assignee.trim())),
      dueDate: task.time.match(/^\d{4}-\d{2}-\d{2}/)?.[0],
      priority: task.priority.toLowerCase(),
      isRecurring: task.status === "todo",
      status: task.status,
      progress: task.progress,
      checklist: task.checklistTitles?.map((item) => item.trim()).filter(Boolean),
    };

    const createdTask = await api.post<RawTask>("/tasks", payload);
    setTasks((currentTasks) => [normalizeTask(createdTask), ...currentTasks]);
  };

  const updateTask = async (id: string, update: Partial<TaskDraft>) => {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return;
    const nextState = normalizeTaskState(update.status ?? currentTask.status, update.progress ?? currentTask.progress);

    const nextTask = {
      ...currentTask,
      ...update,
      status: nextState.status,
      priority: update.priority ?? currentTask.priority,
      progress: nextState.progress,
      title: update.title ?? currentTask.title,
      assignee: update.assignee ?? currentTask.assignee,
      time: update.time ?? currentTask.time,
    };

    const payload = {
      title: nextTask.title,
      assigneeId: nextTask.assigneeId ?? Number(Object.keys(userNameMap).find((key) => userNameMap[Number(key)] === nextTask.assignee)),
      dueDate: nextTask.time.match(/^\d{4}-\d{2}-\d{2}/)?.[0],
      priority: nextTask.priority.toLowerCase(),
      isRecurring: nextTask.status === "todo",
      status: nextTask.status,
      progress: nextTask.progress,
    };

    await api.patch(`/tasks/${id}`, payload);
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === id ? nextTask : task)),
    );
  };

  const updateChecklistItem = async (taskId: string, itemId: number, completed: boolean) => {
    const result = await api.patch<Partial<RawTask>>(`/tasks/${taskId}/checklist/${itemId}`, { completed });
    setTasks((currentTasks) => currentTasks.map((task) => task.id === taskId
      ? (() => {
        const state = normalizeTaskState(result.status ?? task.status, result.progress ?? task.progress);
        return { ...task, status: state.status, progress: state.progress, checklist: task.checklist?.map((item) => item.id === itemId ? { ...item, completed } : item) };
      })()
      : task));
  };

  const addChecklistItem = async (taskId: string, title: string) => {
    const item = await api.post<RawChecklistItem & Partial<RawTask>>(`/tasks/${taskId}/checklist`, { title: title.trim() });
    setTasks((currentTasks) => currentTasks.map((task) => task.id === taskId
      ? (() => {
        const state = normalizeTaskState(item.status ?? task.status, item.progress ?? task.progress);
        return { ...task, status: state.status, progress: state.progress, checklist: [...(task.checklist ?? []), item] };
      })()
      : task));
  };

  const deleteTask = async (id: string) => {
    await api.del(`/tasks/${id}`);
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
  };

  const completeTask = async (id: string) => {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return;

    const nextStatus = currentTask.status === "done" ? "todo" : "done";
    await updateTask(id, {
      status: nextStatus,
      progress: nextStatus === "done" ? 100 : 50,
    });
  };

  const value = useMemo<TaskContextValue>(
    () => ({
      tasks,
      addTask,
      updateTask,
      deleteTask,
      completeTask,
      updateChecklistItem,
      addChecklistItem,
    }),
    [tasks],
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
