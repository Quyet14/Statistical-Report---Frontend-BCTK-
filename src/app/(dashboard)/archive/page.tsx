"use client";

import { useMemo, useState } from "react";
import { useTasks } from "@/context/TaskContext";
import { InboxOutlined, ReloadOutlined } from "@ant-design/icons";
import { priorityLabels } from "@/lib/presentation";

const getDateKey = (value?: string) => value?.slice(0, 10) ?? "";

export default function ArchivePage() {
  const { tasks } = useTasks();
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const archivedTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return tasks
      .filter((task) => task.status === "done")
      .filter((task) => {
        const taskDate = getDateKey(task.dueDate ?? task.time);
        if (fromDate && taskDate < fromDate) return false;
        if (toDate && taskDate > toDate) return false;
        if (!normalizedQuery) return true;
        return [task.title, task.assignee, task.departmentName, task.department]
          .some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => getDateKey(b.dueDate ?? b.time).localeCompare(getDateKey(a.dueDate ?? a.time)));
  }, [fromDate, query, tasks, toDate]);

  return (
    <div className="dashboard-page" data-page="archive">
      <div className="page-header">
        <div>
          <span className="eyebrow">Tra cứu vận hành</span>
          <h3 className="page-title">Lưu trữ việc đã hoàn thành</h3>
          <p className="page-description">Lưu giữ kết quả, tra cứu nhanh và kết nối thông tin công việc.</p>
        </div>
      </div>

      <section className="panel-card archive-workspace">
        <div className="section-header"><h4><InboxOutlined aria-hidden="true" /> Hồ sơ công việc</h4><span>{archivedTasks.length} kết quả</span></div>
      <div className="archive-filter-card">
        <label className="filter-field">Tìm kiếm hồ sơ<input
          className="archive-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên việc, người phụ trách, khoa/phòng..."
          aria-label="Tìm kiếm task đã hoàn thành"
        /></label>
        <label className="filter-field">Từ ngày<input className="date-input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Từ ngày" /></label>
        <label className="filter-field">Đến ngày<input className="date-input" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Đến ngày" /></label>
      </div>
      {query || fromDate || toDate ? <button type="button" className="filter-reset" onClick={() => { setQuery(""); setFromDate(""); setToDate(""); }}><ReloadOutlined aria-hidden="true" /> Xóa bộ lọc</button> : null}

      <div className="table-scroll">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Nội dung</th>
              <th>Khoa/phòng</th>
              <th>Người phụ trách</th>
              <th>Ngày hoàn tất</th>
              <th>Ưu tiên</th>
              <th>Tiến độ</th>
            </tr>
          </thead>
          <tbody>
            {archivedTasks.length ? archivedTasks.map((task) => (
              <tr key={task.id}>
                <td>{task.title}</td>
                <td>{task.departmentName ?? task.department ?? "Chưa có phòng ban"}</td>
                <td>{task.assignee}</td>
                <td>{getDateKey(task.dueDate ?? task.time).split("-").reverse().join("/")}</td>
                <td><span className={`priority-tag priority-${task.priority.toLowerCase()}`}>{priorityLabels[task.priority]}</span></td>
                <td><span className="table-status status-done">{task.progress}%</span></td>
              </tr>
            )) : <tr><td colSpan={6} className="empty-table-state">Chưa tìm thấy task hoàn thành phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
      </section>
    </div>
  );
}
