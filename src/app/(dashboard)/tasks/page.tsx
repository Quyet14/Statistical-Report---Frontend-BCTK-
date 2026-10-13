"use client";

import { useState } from "react";
import { useTasks } from "@/context/TaskContext";

const getLocalDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function TasksPage() {
  const { tasks } = useTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const departments = Array.from(new Set(tasks.map((task) => task.departmentName ?? task.department).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
  const dateFilteredTasks = selectedDate ? tasks.filter((task) => task.time.slice(0, 10) === selectedDate) : tasks;
  const visibleTasks = dateFilteredTasks.filter((task) => {
    const department = task.departmentName ?? task.department ?? "";
    const matchesDepartment = departmentFilter === "all" || department === departmentFilter;
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    return matchesDepartment && matchesStatus;
  });
  const stats = [
    { label: "Nhiệm vụ đang mở", value: visibleTasks.filter((task) => task.status !== "done").length, tint: "blue" },
    { label: "Chưa bắt đầu", value: visibleTasks.filter((task) => task.status === "todo").length, tint: "red" },
    { label: "Hoàn thành", value: visibleTasks.filter((task) => task.status === "done").length, tint: "green" },
  ];
  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const firstDayOffset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: firstDayOffset + daysInMonth }, (_, index) => index < firstDayOffset ? null : index - firstDayOffset + 1);
  const taskCountByDate = tasks.reduce<Record<string, number>>((counts, task) => {
    const date = task.time.slice(0, 10);
    counts[date] = (counts[date] ?? 0) + 1;
    return counts;
  }, {});
  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Thực thi</span>
          <h3 className="page-title">Quản lý nhiệm vụ</h3>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((item) => (
          <div key={item.label} className={`stat-card ${item.tint}`}>
            <span className="stat-label">{item.label}</span>
            <div className="stat-value">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="panel-card table-card">
        <div className="task-filter-bar">
          <div>
            <strong>Bộ lọc nhiệm vụ</strong>
            <span>{visibleTasks.length}/{dateFilteredTasks.length} task đang hiển thị</span>
          </div>
          <div className="toolbar">
            <select className="soft-select" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Lọc theo phòng ban">
              <option value="all">Tất cả phòng ban</option>
              {departments.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select className="soft-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc theo trạng thái">
              <option value="all">Tất cả trạng thái</option>
              <option value="todo">Chưa bắt đầu</option>
              <option value="doing">Đang làm</option>
              <option value="done">Hoàn thành</option>
            </select>
          </div>
        </div>
        <div className="task-calendar-bar">
          <div className="personal-calendar task-calendar">
            <div className="personal-calendar-header">
              <button type="button" className="calendar-nav" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} aria-label="Tháng trước">‹</button>
              <strong>{monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}</strong>
              <button type="button" className="calendar-nav" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} aria-label="Tháng sau">›</button>
            </div>
            <div className="personal-calendar-grid personal-calendar-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
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
            <strong>{selectedDate ? `Nhiệm vụ ngày ${selectedDate.split("-").reverse().join("/")}` : "Tất cả nhiệm vụ"}</strong>
            <span>{visibleTasks.length} nhiệm vụ</span>
            {selectedDate ? <button type="button" className="secondary-action" onClick={() => setSelectedDate(null)}>Xem tất cả ngày</button> : null}
            {selectedDate && visibleTasks.length ? (
              <div className="task-calendar-items">
                {visibleTasks.map((task) => (
                  <button key={task.id} type="button" className="task-calendar-item" onClick={() => setSelectedTaskId(task.id)}>
                    <span>{task.title}</span>
                    <small>{task.assignee} · {task.status === "done" ? "Hoàn thành" : task.status === "doing" ? "Đang làm" : "Chờ xử lý"}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <table className="modern-table">
          <thead>
            <tr>
              <th>Nhiệm vụ</th>
              <th>Phòng ban</th>
              <th>Người phụ trách</th>
              <th>Trạng thái</th>
              <th>Hạn chót</th>
            </tr>
          </thead>
          <tbody>
            {visibleTasks.length ? visibleTasks.map((task) => (
              <tr key={task.id} className="clickable-row" onClick={() => setSelectedTaskId(task.id)}>
                <td>{task.title}</td>
                <td>{task.departmentName ?? task.department ?? "Chưa có phòng ban"}</td>
                <td>{task.assignee}</td>
                <td>
                  <span className={`table-status status-${task.status}`}>
                    {task.status === "done" ? "Hoàn thành" : task.status === "doing" ? "Đang làm" : "Chờ xử lý"}
                  </span>
                </td>
                <td>{task.time}</td>
              </tr>
            )) : <tr><td colSpan={5} className="empty-table-state">Không có task được hiển thị cho tài khoản này.</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedTask ? (
        <div className="task-detail-backdrop" onClick={() => setSelectedTaskId(null)}>
          <section className="task-detail-page" onClick={(event) => event.stopPropagation()} aria-label={`Chi tiết task ${selectedTask.title}`}>
            <div className="task-detail-header">
              <div>
                <span className="eyebrow">Chi tiết nhiệm vụ</span>
                <h3 className="page-title">{selectedTask.title}</h3>
              </div>
              <button type="button" className="secondary-action" onClick={() => setSelectedTaskId(null)}>Đóng</button>
            </div>

            <div className="task-detail-grid">
              <div className="task-detail-item"><span>Phòng ban</span><strong>{selectedTask.departmentName ?? selectedTask.department ?? "Chưa có phòng ban"}</strong></div>
              <div className="task-detail-item"><span>Người phụ trách</span><strong>{selectedTask.assignee}</strong></div>
              <div className="task-detail-item"><span>Trạng thái</span><strong>{selectedTask.status === "done" ? "Hoàn thành" : selectedTask.status === "doing" ? "Đang làm" : "Chưa bắt đầu"}</strong></div>
              <div className="task-detail-item"><span>Hạn chót</span><strong>{selectedTask.time}</strong></div>
              <div className="task-detail-item"><span>Mức độ ưu tiên</span><strong>{selectedTask.priority}</strong></div>
              <div className="task-detail-item"><span>Tiến độ</span><strong>{selectedTask.progress}%</strong></div>
            </div>

            <div className="task-detail-section">
              <div className="section-header"><h4>Tiến độ thực hiện</h4><strong>{selectedTask.progress}%</strong></div>
              <div className="progress-track"><span className={`progress-bar ${selectedTask.status}`} style={{ width: `${selectedTask.progress}%` }} /></div>
            </div>

            <div className="task-detail-section">
              <div className="section-header"><h4>Checklist công việc</h4><span>{selectedTask.checklist?.length ?? 0} mục</span></div>
              {selectedTask.checklist?.length ? (
                <div className="task-detail-checklist">
                  {selectedTask.checklist.map((item) => <div key={item.id} className="task-detail-checklist-item"><span className={item.completed ? "checked" : ""}>{item.completed ? "✓" : "○"}</span>{item.title}</div>)}
                </div>
              ) : <p className="task-status">Task này chưa có checklist.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
