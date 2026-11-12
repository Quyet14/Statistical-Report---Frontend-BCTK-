export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "Low" | "Medium" | "High";

export interface TaskItem {
  id: string;
  title: string;
  titleEn?: string | null;
  description?: string;
  assignee: string;
  assigneeId?: number;
  departmentId?: number | null;
  departmentName?: string | null;
  createdById?: number;
  reviewerId?: number | null;
  canReview?: boolean;
  delegatedReview?: boolean;
  isParticipant?: boolean;
  approvalSteps?: {position:number;reviewerId:number;reviewerName?:string;state:string}[];
  approvalState?: "draft" | "submitted" | "approved" | "rejected";
  rejectionReason?: string | null;
  locked?: boolean;
  time: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  dueDate?: string;
  completedDay?: string | null;
  checklist?: {
    id: number;
    title: string;
    titleEn?: string | null;
    completed: boolean;
    fieldType?: "tick" | "number" | "signature";
    numberValue?: number | null;
    signedById?: number | null;
    signedAt?: string | null;
    outcome?: "pending" | "pass" | "fail" | "na";
  }[];
  department?: string;
}
