"use client";

import { TaskCard } from "@/components/checklist/TaskCard";
import { useEffect, useState, type DragEvent } from "react";
import { useTasks } from "@/context/TaskContext";
import { getStoredUser, type CurrentUser } from "@/lib/auth";
import type { TaskStatus } from "@/types";
import { CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined } from "@ant-design/icons";

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
  { status: "todo", title: "Chờ xử lý", hint: "Việc mới giao hoặc chưa bắt đầu" },
  { status: "doing", title: "Đang làm", hint: "Đang được khoa/phòng xử lý" },
  { status: "done", title: "Hoàn thành", hint: "Đã kết thúc hoặc đã được ghi nhận" },
];

const progressByStatus: Record<TaskStatus, number> = {
  todo: 0,
  doing: 50,
  done: 100,
};

const getStoredChecklistFilter = () => {
  if (typeof window === "undefined") return "week";
  const saved = window.localStorage.getItem("checklist-range");
  return saved === "today" || saved === "week" || saved === "all" ? saved : "week";
};

export default function ChecklistPage() {
  const { tasks, updateTask, deleteTask, updateChecklistItem, addChecklistItem } = useTasks();
  const [currentUser] = useState<CurrentUser | null>(() => getStoredUser());
  const [filter, setFilter] = useState<"today" | "week" | "all">(getStoredChecklistFilter);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  const selectedDate = getLocalDate();
  const [weekStart, weekEnd] = getWeekBounds(new Date());
  useEffect(() => {
    if (tasks.length === 0 || filter === "all") return;

    const hasTasksInFilter = tasks.some((task) => {
      const taskDate = dateKey(task.dueDate ?? task.time);
      if (!taskDate) return false;
      if (filter === "today") return taskDate === selectedDate;
      const date = new Date(`${taskDate}T00:00:00`);
      return date >= new Date(weekStart.toDateString()) && date <= new Date(weekEnd.toDateString());
    });
    if (!hasTasksInFilter) {
      window.localStorage.setItem("checklist-range", "all");
      window.setTimeout(() => setFilter("all"), 0);
    }
  }, [filter, selectedDate, tasks, weekEnd, weekStart]);

  const visibleTasks = tasks.filter((task) => {
    const taskDate = dateKey(task.dueDate ?? task.time);
    if (!taskDate) return false;
    if (filter === "all") return true;
    if (filter === "today") return taskDate === selectedDate;
    const date = new Date(`${taskDate}T00:00:00`);
    return date >= new Date(weekStart.toDateString()) && date <= new Date(weekEnd.toDateString());
  });
  const summaryCards = [
    { label: "Hoàn thành", value: visibleTasks.filter((task) => task.status === "done").length, tone: "green", icon: CheckCircleOutlined, hint: "Đã hoàn tất công việc" },
    { label: "Đang làm", value: visibleTasks.filter((task) => task.status === "doing").length, tone: "blue", icon: PlayCircleOutlined, hint: "Đang được triển khai" },
    { label: "Chưa bắt đầu", value: visibleTasks.filter((task) => task.status === "todo").length, tone: "red", icon: ClockCircleOutlined, hint: "Sẵn sàng để bắt đầu" },
  ];
  const completionRate = visibleTasks.length ? Math.round(summaryCards[0].value / visibleTasks.length * 100) : 0;

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
          <span className="eyebrow">Tổng quan vận hành</span>
          <h3 className="page-title">Việc cần làm hôm nay</h3>
        </div>

        <div className="toolbar">
          <select className="soft-select" value={filter} onChange={(event) => { const value = event.target.value as "today" | "week" | "all"; setFilter(value); window.localStorage.setItem("checklist-range", value); }} aria-label="Chọn khoảng thời gian">
            <option value="today">Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="all">Tất cả công việc</option>
          </select>
        </div>
      </div>

      <div className="stats-grid">
        {summaryCards.map((item) => (
          <div key={item.label} className={`stat-card ${item.tone}`}>
            <span className="stat-icon"><item.icon aria-hidden="true" /></span>
            <span className="stat-label">{item.label}</span>
            <div className="stat-value">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="board-heading" id="work-board">
        <h3>Bảng công việc</h3>
        <div className="board-summary">
          <span>{visibleTasks.length} công việc · {completionRate}% hoàn thành</span>
          <div className="board-progress" role="progressbar" aria-label="Tỷ lệ công việc hoàn thành" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionRate}><span style={{ width: `${completionRate}%` }} /></div>
        </div>
      </div>
      <div className="kanban-board">
        {kanbanColumns.map((column) => {
          const columnTasks = visibleTasks.filter((task) => task.status === column.status);

          return (
            <section
              key={column.status}
              className={`kanban-column status-${column.status}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, column.status)}
            >
              <div className="kanban-column-header">
                <div>
                  <h4>{column.title}</h4>
                  <span>{column.hint}</span>
                </div>
                <strong>{columnTasks.length}</strong>
              </div>

              <div className="kanban-column-body">
                {columnTasks.length ? columnTasks.map((task) => {
                  const canManage = currentUser?.role?.toLowerCase() === "admin" || task.createdById === currentUser?.id;
                  return (
                    <div
                      key={task.id}
                      className="kanban-card-wrap"
                      draggable
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
                        assignee={task.assignee}
                        time={task.time}
                        status={task.status}
                        progress={task.progress}
                        checklist={task.checklist}
                        onToggleChecklist={updateChecklistItem}
                        onAddChecklist={addChecklistItem}
                        priority={task.priority}
                        department={task.departmentName ?? task.department}
                        onToggleComplete={(id, nextStatus) => {
                          void updateTask(id, {
                            status: nextStatus,
                            progress: progressByStatus[nextStatus],
                          });
                        }}
                        onUpdate={canManage ? updateTask : undefined}
                        onDelete={canManage ? deleteTask : undefined}
                      />
                    </div>
                  );
                }) : <div className="kanban-empty">Chưa có công việc trong cột này</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
