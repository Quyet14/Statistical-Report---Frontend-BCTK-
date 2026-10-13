export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "Low" | "Medium" | "High";

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  assignee: string;
  assigneeId?: number;
  departmentId?: number | null;
  departmentName?: string | null;
  createdById?: number;
  time: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  dueDate?: string;
  checklist?: { id: number; title: string; completed: boolean }[];
  department?: string;
}
