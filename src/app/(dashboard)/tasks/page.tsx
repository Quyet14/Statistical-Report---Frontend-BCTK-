"use client";

import { useMemo, useState } from "react";
import { useTasks } from "@/context/TaskContext";
import { SummaryCard } from "@/components/common/SummaryCard";
import { CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, CalendarOutlined, DownOutlined } from "@ant-design/icons";
import { formatTaskDate, priorityLabels } from "@/lib/presentation";
import { useLocale } from "@/i18n/locale-provider";

const getLocalDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export default function TasksPage() {
  const { tasks } = useTasks();
  const { locale, t } = useLocale();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const {
    departments,
    dateFilteredTasks,
    visibleTasks,
    countsByStatus,
    taskCountByDate,
  } = useMemo(() => {
    const departmentNames = new Set<string>();
    const dateTasks = [];
    const visible = [];
    const counts: Record<"todo" | "doing" | "done", number> = {
      todo: 0,
      doing: 0,
      done: 0,
    };
    const dayCounts: Record<string, number> = {};

    for (const task of tasks) {
      const department = task.departmentName ?? task.department;
      if (department) departmentNames.add(department);

      const date = task.time.slice(0, 10);
      dayCounts[date] = (dayCounts[date] ?? 0) + 1;
      if (selectedDate && date !== selectedDate) continue;

      dateTasks.push(task);
      const matchesDepartment =
        departmentFilter === "all" || department === departmentFilter;
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      if (!matchesDepartment || !matchesStatus) continue;

      visible.push(task);
      counts[task.status]++;
    }

    return {
      departments: [...departmentNames].sort((a, b) => a.localeCompare(b)),
      dateFilteredTasks: dateTasks,
      visibleTasks: visible,
      countsByStatus: counts,
      taskCountByDate: dayCounts,
    };
  }, [departmentFilter, selectedDate, statusFilter, tasks]);
  const stats = [
    { label: t("checklist.inProgress"), value: countsByStatus.doing, tint: "blue" as const, icon: PlayCircleOutlined },
    { label: t("checklist.notStarted"), value: countsByStatus.todo, tint: "red" as const, icon: ClockCircleOutlined },
    { label: t("checklist.completed"), value: countsByStatus.done, tint: "green" as const, icon: CheckCircleOutlined },
  ];
  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const firstDayOffset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: firstDayOffset + daysInMonth }, (_, index) => index < firstDayOffset ? null : index - firstDayOffset + 1);
  return (
    <div className="dashboard-page" data-page="tasks">
      <div className="page-header">
        <div>
          <span className="eyebrow">{t("tasks.execution")}</span>
          <h3 className="page-title">{t("tasks.title")}</h3>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((item) => (
          <SummaryCard key={item.label} label={item.label} value={item.value} tone={item.tint} icon={<item.icon />} />
        ))}
      </div>

      <div className="panel-card table-card">
        <div className="task-filter-bar">
          <div>
            <strong>{t("tasks.list")}</strong>
            <span>{visibleTasks.length}/{dateFilteredTasks.length} {t("tasks.displaying")}</span>
          </div>
          <div className="toolbar">
            <select className="soft-select" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label={t("tasks.departmentFilter")}>
              <option value="all">{t("tasks.allDepartments")}</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select className="soft-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label={t("tasks.statusFilter")}>
              <option value="all">{t("tasks.allStatuses")}</option>
              <option value="todo">{t("checklist.notStarted")}</option>
              <option value="doing">{t("checklist.inProgress")}</option>
              <option value="done">{t("checklist.completed")}</option>
            </select>
          </div>
        </div>
        <details className="task-calendar-disclosure">
          <summary><CalendarOutlined aria-hidden="true" /><span>{selectedDate ? `${t("tasks.calendarFilter")} ${formatTaskDate(selectedDate)}` : t("tasks.viewCalendar")}</span><DownOutlined className="disclosure-chevron" aria-hidden="true" /></summary>
        <div className="task-calendar-bar">
          <div className="personal-calendar task-calendar">
            <div className="personal-calendar-header">
              <button type="button" className="calendar-nav" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} aria-label={t("tasks.previousMonth")}>‹</button>
              <strong>{new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { month: "long" }).format(calendarDate)} {calendarDate.getFullYear()}</strong>
              <button type="button" className="calendar-nav" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} aria-label={t("tasks.nextMonth")}>›</button>
            </div>
            <div className="personal-calendar-grid personal-calendar-weekdays">{Array.from({ length: 7 }, (_, index) => { const day = new Date(Date.UTC(2024, 0, index + 1)); return <span key={index}>{new Intl.DateTimeFormat(locale === "en" ? "en-US" : "vi-VN", { weekday: "short", timeZone: "UTC" }).format(day)}</span>; })}</div>
            <div className="personal-calendar-grid">
              {calendarDays.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} className="calendar-day empty" />;
                const date = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const count = taskCountByDate[date] ?? 0;
                return <button key={date} type="button" className={`calendar-day ${selectedDate === date ? "selected" : ""} ${getLocalDate() === date ? "today" : ""}`} onClick={() => setSelectedDate(date)}><span>{day}</span>{count ? <small>{count}</small> : null}</button>;
              })}
            </div>
          </div>
          <div className="task-calendar-summary">
            <strong>{selectedDate ? `${t("tasks.dayTasks")} ${selectedDate.split("-").reverse().join("/")}` : t("tasks.allTasks")}</strong>
            <span>{visibleTasks.length} {t("tasks.taskCount")}</span>
            {selectedDate ? <button type="button" className="secondary-action" onClick={() => setSelectedDate(null)}>{t("tasks.viewAllDays")}</button> : null}
            <span>{t("tasks.selectCalendarDate")}</span>
          </div>
        </div>
        </details>
        <table className="modern-table">
          <thead>
            <tr>
              <th>{t("tasks.task")}</th>
              <th>{t("tasks.department")}</th>
              <th>{t("tasks.assignee")}</th>
              <th>{t("tasks.status")}</th>
              <th>{t("tasks.dueDate")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.length ? visibleTasks.map((task) => (
              <tr key={task.id}>
                <td><button type="button" className="table-title-button" onClick={() => setSelectedTaskId(task.id)}>{locale === "en" && task.titleEn?.trim() ? task.titleEn : task.title}</button></td>
                <td data-i18n-skip>{task.departmentName ?? task.department ?? (locale === "en" ? "No department" : "Chưa có phòng ban")}</td>
                <td data-i18n-skip>{task.assignee}</td>
                <td>
                  <span className={`table-status status-${task.status}`}>
                    {task.status === "done" ? t("checklist.completed") : task.status === "doing" ? t("checklist.inProgress") : t("checklist.todoColumn")}
                  </span>
                </td>
                <td>{formatTaskDate(task.dueDate ?? task.time)}</td>
              </tr>
            )) : <tr><td colSpan={5} className="empty-table-state">{t("tasks.empty")}</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedTask ? (
        <div className="task-detail-backdrop" onClick={() => setSelectedTaskId(null)}>
          <section className="task-detail-page" onClick={(event) => event.stopPropagation()} aria-label={`${t("tasks.detail")}: ${selectedTask.title}`}>
            <div className="task-detail-header">
              <div>
                <span className="eyebrow">{t("tasks.detail")}</span>
                <h3 className="page-title" data-i18n-skip>{locale === "en" && selectedTask.titleEn?.trim() ? selectedTask.titleEn : selectedTask.title}</h3>
              </div>
              <button type="button" className="secondary-action" onClick={() => setSelectedTaskId(null)}>{t("tasks.close")}</button>
            </div>

            <div className="task-detail-grid">
              <div className="task-detail-item"><span>{t("tasks.department")}</span><strong data-i18n-skip>{selectedTask.departmentName ?? selectedTask.department ?? (locale === "en" ? "No department" : "Chưa có phòng ban")}</strong></div>
              <div className="task-detail-item"><span>{t("tasks.assignee")}</span><strong data-i18n-skip>{selectedTask.assignee}</strong></div>
              <div className="task-detail-item"><span>{t("tasks.status")}</span><strong>{selectedTask.status === "done" ? t("checklist.completed") : selectedTask.status === "doing" ? t("checklist.inProgress") : t("checklist.notStarted")}</strong></div>
              <div className="task-detail-item"><span>{t("tasks.dueDate")}</span><strong>{formatTaskDate(selectedTask.dueDate ?? selectedTask.time)}</strong></div>
              <div className="task-detail-item"><span>{t("taskCard.priority")}</span><strong>{locale === "en" ? ({ Low: "Low", Medium: "Medium", High: "High" } as const)[selectedTask.priority] : priorityLabels[selectedTask.priority]}</strong></div>
              <div className="task-detail-item"><span>{t("tasks.progress")}</span><strong>{selectedTask.progress}%</strong></div>
            </div>

            <div className="task-detail-section">
              <div className="section-header"><h4>{t("tasks.progress")}</h4><strong>{selectedTask.progress}%</strong></div>
              <div className="progress-track"><span className={`progress-bar ${selectedTask.status}`} style={{ width: `${selectedTask.progress}%` }} /></div>
            </div>

            <div className="task-detail-section">
              <div className="section-header"><h4>{t("tasks.checklist")}</h4><span>{selectedTask.checklist?.length ?? 0} {t("tasks.items")}</span></div>
              {selectedTask.checklist?.length ? (
                <div className="task-detail-checklist">
                  {selectedTask.checklist.map((item) => <div key={item.id} className="task-detail-checklist-item"><span className={item.completed ? "checked" : ""}>{item.completed ? "✓" : "○"}</span><span data-i18n-skip>{locale === "en" && item.titleEn?.trim() ? item.titleEn : item.title}</span></div>)}
                </div>
              ) : <p className="task-status">{t("tasks.noChecklist")}</p>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
