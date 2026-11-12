"use client";

import { TaskCard } from "@/components/checklist/TaskCard";
import { TaskWorkflowPanel } from "@/components/checklist/TaskWorkflowPanel";
import { RoleDashboard } from "@/components/checklist/RoleDashboard";
import { useRouter } from "next/navigation";
import { useMemo, useState, type DragEvent } from "react";
import { useTasks } from "@/context/TaskContext";
import { getStoredUser, type CurrentUser } from "@/lib/auth";
import type { TaskStatus } from "@/types";
import { useLocale } from "@/i18n/locale-provider";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const getWeekBounds = (date: Date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [start, end];
};

const dateKey = (value?: string) => value?.slice(0, 10);

const kanbanColumns: { status: TaskStatus; title: string; hint: string }[] = [
  {
    status: "todo",
    title: "Chờ xử lý",
    hint: "Việc mới giao hoặc chưa bắt đầu",
  },
  { status: "doing", title: "Đang làm", hint: "Đang được khoa/phòng xử lý" },
  {
    status: "done",
    title: "Hoàn thành",
    hint: "Đã kết thúc hoặc đã được ghi nhận",
  },
];

const progressByStatus: Record<TaskStatus, number> = {
  todo: 0,
  doing: 50,
  done: 100,
};

const getStoredChecklistFilter = () => {
  if (typeof window === "undefined") return "week";
  const saved = window.localStorage.getItem("checklist-range");
  return saved === "today" || saved === "week" || saved === "all"
    ? saved
    : "week";
};

export default function ChecklistPage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const {
    tasks,
    updateTask,
    deleteTask,
    updateChecklistItem,
    addChecklistItem,
  } = useTasks();
  const [currentUser] = useState<CurrentUser | null>(() => getStoredUser());
  const readOnly = currentUser?.role === "viewer";
  const [filter, setFilter] = useState<"today" | "week" | "all">(
    getStoredChecklistFilter,
  );
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const selectedDate = getLocalDate();
  const [weekStart, weekEnd] = useMemo(
    () => getWeekBounds(new Date(`${selectedDate}T00:00:00`)),
    [selectedDate],
  );
  const { visibleTasks, tasksByStatus } = useMemo(() => {
    const grouped: Record<TaskStatus, typeof tasks> = {
      todo: [],
      doing: [],
      done: [],
    };
    const startOfWeek = new Date(weekStart.toDateString()).getTime();
    const endOfWeek = new Date(weekEnd.toDateString()).getTime();
    const visible = tasks.filter((task) => {
      const taskDate = dateKey(task.dueDate ?? task.time);
      if (!taskDate) return false;
      if (filter === "today" && taskDate !== selectedDate) return false;
      if (filter === "week") {
        const date = new Date(`${taskDate}T00:00:00`).getTime();
        if (date < startOfWeek || date > endOfWeek) return false;
      }
      grouped[task.status].push(task);
      return true;
    });
    return { visibleTasks: visible, tasksByStatus: grouped };
  }, [filter, selectedDate, tasks, weekEnd, weekStart]);
  const summaryCards = [
    {
      label: t("checklist.completed"),
      value: tasksByStatus.done.length,
      tone: "green",
      icon: CheckCircleOutlined,
      hint: t("checklist.completedWork"),
    },
    {
      label: t("checklist.inProgress"),
      value: tasksByStatus.doing.length,
      tone: "blue",
      icon: PlayCircleOutlined,
      hint: t("checklist.workInProgress"),
    },
    {
      label: t("checklist.notStarted"),
      value: tasksByStatus.todo.length,
      tone: "red",
      icon: ClockCircleOutlined,
      hint: t("checklist.readyToStart"),
    },
  ];
  const completionRate = visibleTasks.length
    ? Math.round((summaryCards[0].value / visibleTasks.length) * 100)
    : 0;

  const moveTaskToStatus = (taskId: string, status: TaskStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    void updateTask(taskId, { status, progress: progressByStatus[status] });
  };

  const handleDrop = (event: DragEvent<HTMLElement>, status: TaskStatus) => {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
    if (taskId) moveTaskToStatus(taskId, status);
    setDraggingTaskId(null);
  };

  return (
    <div className="dashboard-page" data-page="checklist">
      <div className="page-header">
        <div>
          <span className="eyebrow">{t("checklist.overview")}</span>
          <h3 className="page-title">{t("checklist.todayTitle")}</h3>
        </div>

        <div className="toolbar">
          <select
            className="soft-select"
            value={filter}
            onChange={(event) => {
              const value = event.target.value as "today" | "week" | "all";
              setFilter(value);
              window.localStorage.setItem("checklist-range", value);
            }}
            aria-label={t("checklist.period")}
          >
            <option value="today">{t("checklist.today")}</option>
            <option value="week">{t("checklist.thisWeek")}</option>
            <option value="all">{t("checklist.allTasks")}</option>
          </select>
        </div>
      </div>

      <RoleDashboard fallback={<div className="stats-grid">
        {summaryCards.map((item) => (
          <div key={item.label} className={`stat-card ${item.tone}`}>
            <span className="stat-icon">
              <item.icon aria-hidden="true" />
            </span>
            <span className="stat-label">{item.label}</span>
            <div className="stat-value">{item.value}</div>
          </div>
        ))}
      </div>} />

      <div className="board-heading" id="work-board">
        <h3>{t("checklist.board")}</h3>
        <div className="board-summary">
          <span>
            {visibleTasks.length} {locale === "en" ? "tasks" : "công việc"} · {completionRate}% {t("checklist.completed").toLowerCase()}
          </span>
          <div
            className="board-progress"
            role="progressbar"
            aria-label={t("checklist.completedRate")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionRate}
          >
            <span style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      </div>
      <div className="kanban-board">
        {kanbanColumns.map((column) => {
          const columnTasks = tasksByStatus[column.status];

          return (
            <section
              key={column.status}
              className={`kanban-column status-${column.status}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, column.status)}
            >
              <div className="kanban-column-header">
                <div>
                  <h4>{column.status === "todo" ? t("checklist.todoColumn") : column.status === "doing" ? t("checklist.doingColumn") : t("checklist.doneColumn")}</h4>
                </div>
                <strong>{columnTasks.length}</strong>
              </div>

              <div className="kanban-column-body">
                {columnTasks.length ? (
                  columnTasks.map((task) => {
                    const canManage =
                      !readOnly &&
                      (currentUser?.role?.toLowerCase() === "admin" ||
                        task.createdById === currentUser?.id);
                    return (
                      <div
                        key={task.id}
                        className="kanban-card-wrap"
                        draggable={!task.locked && !readOnly}
                        onDragStart={(event) => {
                          setDraggingTaskId(task.id);
                          event.dataTransfer.setData("text/plain", task.id);
                          event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => setDraggingTaskId(null)}
                      >
                        <TaskCard
                          id={task.id}
                          title={task.title}
                          titleEn={task.titleEn}
                          assignee={task.assignee}
                          time={task.time}
                          status={task.status}
                          progress={task.progress}
                          locked={task.locked || readOnly}
                          extra={<TaskWorkflowPanel task={task} />}
                          checklist={task.checklist}
                          onToggleChecklist={
                            task.locked || readOnly
                              ? undefined
                              : updateChecklistItem
                          }
                          onAddChecklist={
                            task.locked || readOnly
                              ? undefined
                              : addChecklistItem
                          }
                          onReportFailure={
                            !readOnly && task.assigneeId === currentUser?.id
                              ? (taskId, itemId) => {
                                  router.push(`/hospital-operations?taskId=${encodeURIComponent(taskId)}&itemId=${itemId}`);
                                }
                              : undefined
                          }
                          priority={task.priority}
                          department={task.departmentName ?? task.department}
                          onToggleComplete={(id, nextStatus) => {
                            void updateTask(id, {
                              status: nextStatus,
                              progress: progressByStatus[nextStatus],
                            });
                          }}
                          onUpdate={
                            canManage && !task.locked ? updateTask : undefined
                          }
                          onDelete={canManage ? deleteTask : undefined}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="kanban-empty">
                    {t("checklist.emptyColumn")}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
