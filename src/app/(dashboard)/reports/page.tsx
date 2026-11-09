"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { TaskItem } from "@/types";
import { reportWorkbook } from "@/lib/report-xlsx";
import { getStoredUser } from "@/lib/auth";
import { SummaryCard } from "@/components/common/SummaryCard";
import { CheckCircleOutlined, PieChartOutlined, ClockCircleOutlined, SafetyCertificateOutlined } from "@ant-design/icons";

const getLocalDate = () => {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
};

const getDateKey = (task: TaskItem) => (task.dueDate ?? task.time)?.slice(0, 10);

const isLateTask = (task: TaskItem, todayKey = getLocalDate()) => {
  const dateKey = getDateKey(task);
  return Boolean(dateKey && (task.status === "done" ? task.completedDay && task.completedDay > dateKey : dateKey < todayKey));
};

type ReportResponse = {
  data?: {
    tasks?: (Omit<TaskItem, "id"> & { id: string | number })[];
    comparison?: { completionRateDelta: number; previousTotal: number };
    onTimeTasks?: number;
    completionDateUnknown?: number;
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

export default function ReportsPage() {
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [departmentError, setDepartmentError] = useState("");
  const [serverTasks, setServerTasks] = useState<TaskItem[] | null>(null);
  const [reportError, setReportError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [comparison, setComparison] = useState<{ completionRateDelta: number; previousTotal: number } | null>(null);
  const [timeliness, setTimeliness] = useState<{ known: number; unknown: number } | null>(null);
  const [range, setRange] = useState<"day" | "week" | "month">(getStoredReportRange);
  const [selectedDate, setSelectedDate] = useState(getStoredReportDate);
  const [summary, setSummary] = useState({ totalTasks: 0, completedTasks: 0, lateTasks: 0, avgScore: 0 });
  const [categoryData, setCategoryData] = useState<{ name: string; progress: number; count: number; tone: string }[]>([]);
  const [taskList, setTaskList] = useState<{ name: string; status: string; delta: string }[]>([]);
  const [chartData, setChartData] = useState<{ label: string; value: number; done: number }[]>([]);

  useEffect(() => { let cancelled = false; void api.get<{ id: number; name: string }[]>("/departments").then(value => { if (!cancelled) setDepartments(value); }).catch(() => { if (!cancelled) setDepartmentError("Không tải được danh sách khoa/phòng."); }); return () => { cancelled = true; }; }, []);

  useEffect(() => {
    let cancelled = false; setReportLoading(true); setReportError(""); setServerTasks(null);
    setSummary({ totalTasks: 0, completedTasks: 0, lateTasks: 0, avgScore: 0 }); setComparison(null); setTimeliness(null); setCategoryData([]); setTaskList([]); setChartData([]);
    const load = async () => {
      const params = new URLSearchParams({ period: range, date: selectedDate, scope: departmentId ? "department" : "company" });
      if (departmentId) params.set("scopeId", departmentId);
      const json = await api.get<ReportResponse>("/reports?" + params);
      if (cancelled) return;
      if (!json.data || !Array.isArray(json.data.tasks)) throw new Error("Máy chủ chưa trả đủ dữ liệu báo cáo.");
      setSummary({ totalTasks: Number(json.data.totalTasks ?? 0), completedTasks: Number(json.data.completedTasks ?? 0), lateTasks: Number(json.data.lateTasks ?? 0), avgScore: Number(json.data.avgScore ?? 0) });
      setServerTasks(Array.isArray(json.data.tasks) ? json.data.tasks.map(task => ({ ...task, id: String(task.id) })) : null);
      setCategoryData(json.data.categories ?? []); setTaskList(json.data.highlights ?? []); setChartData(json.data.chartData ?? []); setComparison(json.data.comparison ?? null);
      setTimeliness({ known: Number(json.data.onTimeTasks ?? 0), unknown: Number(json.data.completionDateUnknown ?? 0) });
    };
    void load().catch(reason => { if (!cancelled) setReportError(reason instanceof Error ? reason.message : "Không tải được báo cáo."); }).finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [range, selectedDate, departmentId]);

  const { reportTasks, departmentData, lateAlerts } = useMemo(() => {
    const scopedTasks = serverTasks ?? [];
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
    };
  }, [serverTasks]);

  const displaySummary = summary;
  const displayCategories = departmentData.length > 0 ? departmentData : categoryData.map((item) => ({ ...item, late: 0 }));
  const displayCompletionRate = Math.round(displaySummary.avgScore);
  const exportRows = reportTasks;

  const exportExcel = async () => {
    if (exporting || reportLoading || reportError) return; setExporting(true);
    try {
      const logo = await fetch("/hospital-logo.png"); if (!logo.ok) throw new Error("Không tải được logo báo cáo.");
      const rows: (string | number)[][] = [["STT", "Nội dung công việc", "Người phụ trách", "Khoa/phòng", "Hạn hoàn thành", "Trạng thái", "Tiến độ (%)"], ...exportRows.map((task, index) => [index + 1, task.title, task.assignee, task.departmentName ?? task.department ?? "", getDateKey(task) ?? "", task.status === "done" ? "Hoàn thành" : task.approvalState === "submitted" ? "Chờ duyệt" : task.status === "doing" ? "Đang làm" : "Chưa làm", task.progress])];
      const bytes = reportWorkbook(rows, { title: "BÁO CÁO CÔNG VIỆC", period: range + " · " + selectedDate, author: getStoredUser()?.name ?? "", logo: new Uint8Array(await logo.arrayBuffer()) });
      const url = URL.createObjectURL(new Blob([bytes.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = "bao-cao-" + range + "-" + selectedDate + ".xlsx"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setReportError(reason instanceof Error ? reason.message : "Không xuất được báo cáo."); }
    finally { setExporting(false); }
  };

  return (
    <div className="dashboard-page" data-page="reports">
      <div className="report-print-header"><img src="/hospital-logo.png" alt="Logo bệnh viện" /><div><strong>BỆNH VIỆN HỮU NGHỊ</strong><h2>BÁO CÁO CÔNG VIỆC</h2><p>{selectedDate} · {range === "week" ? "Theo tuần" : range === "month" ? "Theo tháng" : "Theo ngày"}</p></div></div>
      {reportError ? <p role="alert" className="workflow-alert">{reportError}</p> : null}
      {departmentError ? <p role="alert" className="workflow-alert">{departmentError}</p> : null}
      {reportLoading ? <p role="status">Đang tổng hợp báo cáo…</p> : null}
      {comparison ? <p className="report-comparison">{comparison.previousTotal ? "So với kỳ trước: tỷ lệ hoàn thành " + (comparison.completionRateDelta > 0 ? "+" : "") + comparison.completionRateDelta + " điểm phần trăm." : "Kỳ trước chưa có dữ liệu để so sánh."}</p> : null}
      <div className="page-header">
        <div>
          <span className="eyebrow">Thông tin chi tiết</span>
          <h3 className="page-title">Báo cáo kết quả</h3>
        </div>

        <div className="toolbar">
            {getStoredUser()?.role === "admin" ? <Link className="secondary-action" href="/reports/templates">Mẫu & lịch gửi</Link> : null}
          <select className="soft-select" aria-label="Khoa/phòng báo cáo" value={departmentId} onChange={event => setDepartmentId(event.target.value)}><option value="">Toàn bệnh viện</option>{departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
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
          <button type="button" className="secondary-action" onClick={() => void exportExcel()} disabled={exporting || reportLoading || !!reportError}>Xuất Excel (.xlsx)</button>
          <button type="button" className="secondary-action" disabled={reportLoading || !!reportError} onClick={() => window.print()}>In / Lưu PDF</button>
        </div>
      </div>

      <div className="stats-grid four-cols">
        <SummaryCard label="Đã hoàn thành" value={displaySummary.completedTasks} tone="green" icon={<CheckCircleOutlined />} />
        <SummaryCard label="Tỷ lệ hoàn thành" value={`${displayCompletionRate}%`} tone="blue" icon={<PieChartOutlined />} />
        <SummaryCard label="Chậm tiến độ" value={displaySummary.lateTasks} tone="amber" icon={<ClockCircleOutlined />} />
        <SummaryCard label="Hoàn thành đúng hạn" value={timeliness?.unknown ? "Chưa đủ dữ liệu" : `${displaySummary.completedTasks ? Math.round((timeliness?.known ?? 0) * 100 / displaySummary.completedTasks) : 0}%`} tone="violet" icon={<SafetyCertificateOutlined />} />
      </div>

      <div className="report-workspace">
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
                  <strong>{item.count} công việc{item.late ? ` · ${item.late} trễ` : ""}</strong>
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
              )) : <div className="task-status">Không có công việc trễ hạn trong kỳ này</div>}
            </div>
          )}
        </div>
      </div>
      </div>
      <div className="report-signatures"><div><strong>NGƯỜI LẬP BÁO CÁO</strong><p>{getStoredUser()?.name}</p></div><div><strong>NGƯỜI DUYỆT</strong><p>(Ký, ghi rõ họ tên)</p></div></div>
    </div>
  );
}
