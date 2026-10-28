"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useTasks } from "@/context/TaskContext";
import type { TaskItem } from "@/types";

const getLocalDate = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const getDateKey = (task: TaskItem) => (task.dueDate ?? task.time)?.slice(0, 10);

const getPeriodBounds = (range: "day" | "week" | "month", selectedDate: string) => {
  const baseDate = new Date(`${selectedDate}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) {
    const today = new Date();
    return { start: today, end: today };
  }

  const start = new Date(baseDate);
  const end = new Date(baseDate);

  if (range === "week") {
    start.setDate(baseDate.getDate() - baseDate.getDay());
    end.setDate(start.getDate() + 6);
  }

  if (range === "month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const isTaskInPeriod = (task: TaskItem, start: Date, end: Date) => {
  const dateKey = getDateKey(task);
  if (!dateKey) return false;
  const taskDate = new Date(`${dateKey}T00:00:00`);
  return taskDate >= start && taskDate <= end;
};

const isLateTask = (task: TaskItem, todayKey = getLocalDate()) => {
  const dateKey = getDateKey(task);
  return Boolean(dateKey && dateKey < todayKey && task.status !== "done");
};

type ReportResponse = {
  data?: {
    totalTasks?: number;
    completedTasks?: number;
    lateTasks?: number;
    avgScore?: number;
    categories?: { name: string; progress: number; count: number; tone: string }[];
    highlights?: { name: string; status: string; delta: string }[];
    chartData?: { label: string; value: number; done: number }[];
  };
};

const getStoredReportRange = () => {
  if (typeof window === "undefined") return "week";
  const savedRange = window.localStorage.getItem("reports-range");
  return savedRange === "day" || savedRange === "week" || savedRange === "month" ? savedRange : "week";
};

const getStoredReportDate = () => {
  if (typeof window === "undefined") return getLocalDate();
  return window.localStorage.getItem("reports-date") ?? getLocalDate();
};

const csvEscape = (value: string | number) => `"${String(value).replaceAll("\"", "\"\"")}"`;

export default function ReportsPage() {
  const { tasks } = useTasks();
  const [range, setRange] = useState<"day" | "week" | "month">(getStoredReportRange);
  const [selectedDate, setSelectedDate] = useState(getStoredReportDate);
  const [summary, setSummary] = useState({ totalTasks: 0, completedTasks: 0, lateTasks: 0, avgScore: 0 });
  const [categoryData, setCategoryData] = useState<{ name: string; progress: number; count: number; tone: string }[]>([]);
  const [taskList, setTaskList] = useState<{ name: string; status: string; delta: string }[]>([]);
  const [chartData, setChartData] = useState<{ label: string; value: number; done: number }[]>([]);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const json = await api.get<ReportResponse>(`/reports?period=${range}&date=${selectedDate}&scope=department`);
        if (json && json.data) {
          setSummary({
            totalTasks: Number(json.data.totalTasks ?? 0),
            completedTasks: Number(json.data.completedTasks ?? 0),
            lateTasks: Number(json.data.lateTasks ?? 0),
            avgScore: Number(json.data.avgScore ?? 0),
          });

          if (Array.isArray(json.data.categories)) {
            setCategoryData(json.data.categories);
          }
          if (Array.isArray(json.data.highlights)) {
            setTaskList(json.data.highlights);
          }
          setChartData(Array.isArray(json.data.chartData) ? json.data.chartData : []);
        }
      } catch (error) {
        console.warn("Reports API unavailable.", error);
      }
    };

    void loadReport();
  }, [range, selectedDate]);

  const { reportTasks, departmentData, lateAlerts, computedSummary } = useMemo(() => {
    const { start, end } = getPeriodBounds(range, selectedDate);
    const scopedTasks = tasks.filter((task) => isTaskInPeriod(task, start, end));
    const totalTasks = scopedTasks.length;
    const completedTasks = scopedTasks.filter((task) => task.status === "done").length;
    const lateTasks = scopedTasks.filter((task) => isLateTask(task)).length;
    const avgScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const grouped = scopedTasks.reduce<Record<string, { total: number; done: number; late: number }>>((acc, task) => {
      const department = task.departmentName ?? task.department ?? "Chưa có phòng ban";
      acc[department] ??= { total: 0, done: 0, late: 0 };
      acc[department].total += 1;
      if (task.status === "done") acc[department].done += 1;
      if (isLateTask(task)) acc[department].late += 1;
      return acc;
    }, {});
    const departmentRows = Object.entries(grouped)
      .map(([name, value]) => {
        const progress = value.total > 0 ? Math.round((value.done / value.total) * 100) : 0;
        const tone = value.late > 0 ? "red" : progress >= 80 ? "green" : progress >= 50 ? "blue" : "amber";
        return { name, progress, count: value.total, late: value.late, tone };
      })
      .sort((a, b) => b.late - a.late || b.count - a.count);
    const lateRows = scopedTasks
      .filter((task) => isLateTask(task))
      .sort((a, b) => String(getDateKey(a)).localeCompare(String(getDateKey(b))))
      .slice(0, 6);

    return {
      reportTasks: scopedTasks,
      departmentData: departmentRows,
      lateAlerts: lateRows,
      computedSummary: { totalTasks, completedTasks, lateTasks, avgScore },
    };
  }, [range, selectedDate, tasks]);

  const displaySummary = reportTasks.length > 0 ? computedSummary : summary;
  const displayCategories = departmentData.length > 0 ? departmentData : categoryData.map((item) => ({ ...item, late: 0 }));
  const displayCompletionRate = Math.round(displaySummary.avgScore);
  const onTimeRate = displaySummary.totalTasks > 0
    ? Math.round(((displaySummary.totalTasks - displaySummary.lateTasks) / displaySummary.totalTasks) * 100)
    : 0;
  const exportRows = reportTasks.length > 0 ? reportTasks : tasks;

  const exportCsv = () => {
    const header = ["Tên task", "Phòng ban", "Người phụ trách", "Trạng thái", "Tiến độ", "Hạn chót", "Ưu tiên"];
    const rows = exportRows.map((task) => [
      task.title,
      task.departmentName ?? task.department ?? "Chưa có phòng ban",
      task.assignee,
      task.status === "done" ? "Hoàn thành" : task.status === "doing" ? "Đang làm" : "Chưa bắt đầu",
      `${task.progress}%`,
      getDateKey(task) ?? "",
      task.priority,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-nhiem-vu-${range}-${selectedDate}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-page" data-page="reports">
      <div className="page-header">
        <div>
          <span className="eyebrow">Thông tin chi tiết</span>
          <h3 className="page-title">Báo cáo kết quả</h3>
          <p className="page-description">Nhìn rõ bức tranh vận hành, nhận diện xu hướng và đưa ra quyết định kịp thời.</p>
        </div>

        <div className="toolbar">
          <div className="toggle-group" aria-label="Chọn thời gian báo cáo">
            <button type="button" className={range === "day" ? "toggle-btn active" : "toggle-btn"} onClick={() => { setRange("day"); window.localStorage.setItem("reports-range", "day"); }}>Theo ngày</button>
            <button
              type="button"
              className={range === "week" ? "toggle-btn active" : "toggle-btn"}
              onClick={() => { setRange("week"); window.localStorage.setItem("reports-range", "week"); }}
            >
              Theo tuần
            </button>
            <button
              type="button"
              className={range === "month" ? "toggle-btn active" : "toggle-btn"}
              onClick={() => { setRange("month"); window.localStorage.setItem("reports-range", "month"); }}
            >
              Theo tháng
            </button>
          </div>
          <input className="date-input" type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); window.localStorage.setItem("reports-date", event.target.value); }} aria-label="Chọn thời gian báo cáo" />
          <button type="button" className="secondary-action" onClick={exportCsv}>Xuất Excel</button>
          <button type="button" className="secondary-action" onClick={() => window.print()}>Lưu PDF</button>
        </div>
      </div>

      <div className="stats-grid four-cols">
        <div className="stat-card green">
          <span className="stat-label">Task hoàn thành</span>
          <div className="stat-value">{displaySummary.completedTasks}</div>
        </div>
        <div className="stat-card blue">
          <span className="stat-label">Tỷ lệ hoàn thành</span>
          <div className="stat-value">{displayCompletionRate}%</div>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Chậm tiến độ</span>
          <div className="stat-value">{displaySummary.lateTasks}</div>
        </div>
        <div className="stat-card violet">
          <span className="stat-label">Đúng tiến độ</span>
          <div className="stat-value">{onTimeRate}%</div>
        </div>
      </div>

      <div className="panel-card chart-panel">
        <div className="chart-header">
          <div>
            <h4>Xu hướng hoàn thành</h4>
            <span>{range === "day" ? "Ngày đã chọn" : range === "week" ? "Tuần chứa ngày đã chọn" : "Tháng chứa ngày đã chọn"}</span>
          </div>
          <strong>{displayCompletionRate}%</strong>
        </div>

        <div className="bar-chart" aria-label="Biểu đồ hoàn thành task">
          {chartData.length ? chartData.map((item) => (
            <div key={item.label} className="bar-col">
              <div className="bar-wrap">
                <span className="bar-fill" style={{ height: `${item.value}%` }} />
              </div>
              <div className="bar-label">{item.label}</div>
            </div>
          )) : <div className="task-status">Chưa có dữ liệu trong khoảng thời gian này</div>}
        </div>
      </div>

      <div className="report-lower-grid">
        <div className="panel-card">
          <div className="section-header">
            <h4>Phân loại theo phòng ban</h4>
          </div>

          <div className="category-list">
            {displayCategories.length > 0 ? displayCategories.map((item) => (
              <div key={item.name} className="category-row">
                <div className="category-meta">
                  <span>{item.name}</span>
                  <strong>{item.count} task{item.late ? ` · ${item.late} trễ` : ""}</strong>
                </div>
                <div className="mini-progress">
                  <span className={item.tone} style={{ width: `${item.progress}%` }} />
                </div>
                <div className="category-percent">{item.progress}%</div>
              </div>
            )) : <div className="task-status">Chưa có dữ liệu</div>}
          </div>
        </div>

        <div className="panel-card">
          <div className="section-header">
            <h4>Cảnh báo trễ hạn</h4>
          </div>

          {lateAlerts.length > 0 ? (
            <div className="task-list">
              {lateAlerts.map((task) => (
                <div key={task.id} className="task-list-item alert-item">
                  <div>
                    <div className="task-name">{task.title}</div>
                    <div className="task-status">{task.departmentName ?? task.department ?? "Chưa có phòng ban"} · {task.assignee} · hạn {getDateKey(task)?.split("-").reverse().join("/")}</div>
                  </div>
                  <span className="delta negative">{task.progress}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="task-list">
              {taskList.length > 0 ? taskList.map((task) => (
              <div key={task.name} className="task-list-item">
                <div>
                  <div className="task-name">{task.name}</div>
                  <div className="task-status">{task.status}</div>
                </div>
                <span className={`delta ${task.delta.startsWith("-") ? "negative" : "positive"}`}>
                  {task.delta}
                </span>
              </div>
              )) : <div className="task-status">Không có task trễ hạn trong kỳ này</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
