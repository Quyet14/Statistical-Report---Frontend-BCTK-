"use client";

import { useState } from "react";
import { useTasks } from "@/context/TaskContext";
import { SummaryCard } from "@/components/common/SummaryCard";
import { CheckCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, CalendarOutlined, DownOutlined } from "@ant-design/icons";
import { formatTaskDate, priorityLabels } from "@/lib/presentation";

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
    { label: "Đang làm", value: visibleTasks.filter((task) => task.status === "doing").length, tint: "blue" as const, icon: PlayCircleOutlined },
    { label: "Chưa bắt đầu", value: visibleTasks.filter((task) => task.status === "todo").length, tint: "red" as const, icon: ClockCircleOutlined },
    { label: "Hoàn thành", value: visibleTasks.filter((task) => task.status === "done").length, tint: "green" as const, icon: CheckCircleOutlined },
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
    <div className="dashboard-page" data-page="tasks">
      <div className="page-header">
        <div>
          <span className="eyebrow">Thực thi</span>
          <h3 className="page-title">Quản lý nhiệm vụ</h3>
          <p className="page-description">Điều phối đúng người, nắm rõ tiến độ và chủ động với mọi thời hạn.</p>
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
            <strong>Danh sách nhiệm vụ</strong>
            <span>{visibleTasks.length}/{dateFilteredTasks.length} công việc đang hiển thị</span>
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
        <details className="task-calendar-disclosure">
          <summary><CalendarOutlined aria-hidden="true" /><span>{selectedDate ? `Lọc theo ngày ${formatTaskDate(selectedDate)}` : "Xem lịch công việc"}</span><DownOutlined className="disclosure-chevron" aria-hidden="true" /></summary>
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
            <span>Chọn ngày trên lịch để lọc danh sách bên dưới.</span>
          </div>
        </div>
        </details>
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
              <tr key={task.id}>
                <td><button type="button" className="table-title-button" onClick={() => setSelectedTaskId(task.id)}>{task.title}</button></td>
                <td>{task.departmentName ?? task.department ?? "Chưa có phòng ban"}</td>
                <td>{task.assignee}</td>
                <td>
                  <span className={`table-status status-${task.status}`}>
                    {task.status === "done" ? "Hoàn thành" : task.status === "doing" ? "Đang làm" : "Chờ xử lý"}
                  </span>
                </td>
                <td>{formatTaskDate(task.dueDate ?? task.time)}</td>
              </tr>
            )) : <tr><td colSpan={5} className="empty-table-state">Chưa có công việc phù hợp với bộ lọc.</td></tr>}
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
              <div className="task-detail-item"><span>Hạn chót</span><strong>{formatTaskDate(selectedTask.dueDate ?? selectedTask.time)}</strong></div>
              <div className="task-detail-item"><span>Mức độ ưu tiên</span><strong>{priorityLabels[selectedTask.priority]}</strong></div>
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
