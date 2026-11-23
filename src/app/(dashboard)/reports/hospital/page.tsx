"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/http";
import { getStoredUser } from "@/lib/session";
import { readHospitalReportFilters, saveHospitalReportFilters } from "@/lib/hospital-report-preferences";
import { BarChartOutlined, DatabaseOutlined, CalendarOutlined, TeamOutlined, LoginOutlined, LogoutOutlined, HeartOutlined, DollarOutlined, ReloadOutlined } from "@ant-design/icons";
import styles from "./page.module.css";
import { HospitalCharts } from "./HospitalCharts";
import LiveActivityBoard from "./LiveActivityBoard";

type Metrics = { visits: number; admissions: number; discharges: number; currentInpatients: number; bedOccupancy: number | null; revenue: number | null };
type FptSummary = { source: "fpt-dashboard"; reportDate: string; visits: number; emergency: number; inpatients: number; revenue: number };
type ClsReport = {
  requested: number;
  performed: number;
  waiting: number;
  trend: { day: string; requested: number; performed: number; waiting: number }[];
  byServiceType: { name: string; requested: number }[];
  byServiceGroup: { name: string; requested: number; performed: number; waiting: number }[];
};
type Report = { status: "connected"; metrics: Metrics; asOf: string; generatedAt: string; cacheSeconds: number; fptSummary?: FptSummary; bedSnapshot?: { active: number; occupied: number; asOf: string }; cash?: { collected: number; refunded: number; invalid: number }; trend: { day: string; visits: number; admissions: number }[]; breakdown: { routine: number; emergency: number }; departments: ({ id: number | null; name: string } & Omit<Metrics, "bedOccupancy">)[]; unavailable: Record<string, string>; cls?: ClsReport } | { status: "disabled" | "loading"; message: string };
const indicators = [
  { key: "visits", label: "Lượt khám", unit: "phiếu khám", icon: TeamOutlined, tone: "blue", definition: "Số phiếu KhamBenh theo ngày khám; không phải số người duy nhất." },
  { key: "admissions", label: "Nhập viện", unit: "lượt", icon: LoginOutlined, tone: "purple", definition: "Bệnh án có phiếu nhập viện, theo ngày vào viện." },
  { key: "discharges", label: "Xuất viện", unit: "lượt", icon: LogoutOutlined, tone: "green", definition: "Bệnh án có phiếu nhập viện, theo ngày ra viện." },
  { key: "currentInpatients", label: "Đang điều trị", unit: "bệnh án", icon: HeartOutlined, tone: "pink", definition: "Bệnh án chưa ra viện tại thời điểm chốt số liệu; không phải tổng nhập viện trong kỳ." },
  { key: "bedOccupancy", label: "Công suất giường", unit: "%", icon: BarChartOutlined, tone: "orange", definition: "Tỷ lệ giường đang dùng trên giường không tạm ngưng trong danh mục HIS, tại thời điểm hiện tại; không phải công suất bình quân theo kỳ." },
  { key: "revenue", label: "Thực thu", unit: "VNĐ", icon: DollarOutlined, tone: "teal", definition: "Chứng từ đã thanh toán, không hủy trong HIS, gồm tạm ứng, trừ hoàn trả; phân theo nơi lập chứng từ, không phải doanh thu dịch vụ." },
] as const;
const number = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
const cashValue = (value: number | null | undefined) => value == null ? "—" : Math.abs(value) >= 1e9 ? `${number(value / 1e9)} tỷ` : Math.abs(value) >= 1e6 ? `${number(value / 1e6)} triệu` : number(value);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function HospitalReportsPage() {
  const [period, setPeriod] = useState("day");
  const [date, setDate] = useState(today);
  const [filtersReady, setFiltersReady] = useState(false);
  const preferenceKey = `careops.hospital-report.filters.v1:${getStoredUser()?.id ?? "guest"}`;
  useEffect(() => {
    let active = true;
    let saved = { period: "month", date: today() };
    try { saved = readHospitalReportFilters(window.localStorage, preferenceKey, saved); } catch { /* Browser storage may be disabled. */ }
    queueMicrotask(() => {
      if (!active) return;
      setPeriod(saved.period); setDate(saved.date); setFiltersReady(true);
    });
    return () => { active = false; };
  }, [preferenceKey]);
  const changeFilters = (nextPeriod: string, nextDate: string) => {
    setPeriod(nextPeriod); setDate(nextDate);
    try { saveHospitalReportFilters(window.localStorage, preferenceKey, { period: nextPeriod, date: nextDate }); } catch { /* Keep the current selection when storage is unavailable. */ }
  };
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [result, setResult] = useState<{ key: string; data?: Report; error?: string } | null>(null);
  const key = `${period}:${date}`;
  const query = `/reports/hospital?period=${period}&date=${encodeURIComponent(date)}`;
  useEffect(() => {
    if (!date || !filtersReady) return;
    let cancelled = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout>;
    let lastStarted = 0;
    let revision = "";
    let failures = 0;
    let connection: AbortController | undefined;
    const refresh = async () => {
      if (cancelled || pending || document.hidden || !navigator.onLine) return;
      pending = true;
      lastStarted = Date.now();
      if (!revision) setRefreshing(true);
      connection = new AbortController();
      let delay = 1000;
      try {
        const data = await requestJson<Report & { revision?: string }>(`${query}${revision ? `&since=${revision}` : ""}`, { signal: connection.signal });
        if (!cancelled) {
          if (!revision || data.revision !== revision) setResult(previous => data.status === "loading" && previous?.key === key && previous.data?.status === "connected" ? previous : { key, data });
          revision = data.status === "connected" ? data.revision ?? "" : "";
          failures = 0;
          delay = revision ? Math.max(0, 250 - (Date.now() - lastStarted)) : data.status === "disabled" ? 15000 : 1000;
          setRefreshError("");
        }
      } catch (error) {
        if (!cancelled && !connection.signal.aborted) {
          const message = error instanceof Error ? error.message : "Không tải được báo cáo";
          setRefreshError(message);
          setResult(previous => previous?.key === key && previous.data?.status === "connected" ? previous : { key, error: message });
          delay = Math.min(30000, 1000 * 2 ** Math.min(++failures, 5));
        }
      } finally {
        pending = false;
        if (!cancelled) { setRefreshing(false); clearTimeout(timer); timer = setTimeout(() => void refresh(), delay); }
      }
    };
    const resume = () => {
      if (document.hidden || !navigator.onLine) { connection?.abort(); return; }
      if (Date.now() - lastStarted >= 1000) void refresh();
    };
    const manual = () => { void refresh(); };
    void refresh();
    window.addEventListener("hospital-report-refresh", manual);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelled = true; clearTimeout(timer); connection?.abort();
      window.removeEventListener("hospital-report-refresh", manual);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [date, key, query, filtersReady]);
  const current = result?.key === key ? result : null;
  const data = current?.data?.status === "connected" ? current.data : null;
  const loading = Boolean(date) && (!filtersReady || !current || current.data?.status === "loading");
  const periodName = period === "day" ? "Theo ngày" : period === "month" ? "Theo tháng" : "Theo năm";
  const fptSummary = data?.fptSummary;
  const state = loading ? "Đang tải số liệu" : data ? "SQL · Đã kết nối" : current?.error ? "Không tải được số liệu" : "Nguồn chưa bật";

  return <div className={`dashboard-page ${styles.page}`} aria-busy={loading}>
    <div className={styles.overviewShell}>
    <header className={styles.hero}>
      <div><h1>Báo cáo bệnh viện</h1></div>
      <div className={styles.heroActions}><span className={styles.sourcePill}><span /> {refreshing ? "Đang cập nhật" : refreshError ? "Dữ liệu chưa cập nhật" : state} <DatabaseOutlined /></span><button className="secondary-action" onClick={() => window.dispatchEvent(new Event("hospital-report-refresh"))} disabled={refreshing || !date}><ReloadOutlined spin={refreshing} /> Tải lại</button></div>
    </header>
    {current?.data?.status === "loading" && <p role="status" className={styles.pending}><ReloadOutlined spin /> Đang tổng hợp báo cáo {period === "day" ? "ngày" : period === "month" ? "tháng" : "năm"}. Số liệu sẽ tự hiển thị khi hoàn tất.</p>}
    {current?.error && <p role="alert" className={styles.error}>{current.error}</p>}
    {data && refreshError && <p role="status" className={styles.error}>Chưa cập nhật được số liệu mới. Đang hiển thị bản lúc {data.asOf.replace("T", " ")}; hệ thống sẽ tự thử lại.</p>}
    <section className={styles.toolbar} aria-label="Bộ lọc báo cáo">
      <div><CalendarOutlined /><strong>Kỳ báo cáo</strong></div>
      <label><span>Thống kê</span><select aria-label="Thống kê" value={period} disabled={!filtersReady} onChange={e => changeFilters(e.target.value, date)}><option value="day">Theo ngày</option><option value="month">Theo tháng</option><option value="year">Theo năm</option></select></label>
      <label><span>Ngày tham chiếu</span><input type="date" aria-label="Ngày tham chiếu" required value={date} disabled={!filtersReady} onChange={e => changeFilters(period, e.target.value)} /></label>
    </section>
    </div>
    <div className={styles.period}><h2>Tổng quan hoạt động</h2><span>{periodName} · {date ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${date}T12:00:00`)) : "Chọn ngày"}</span></div>
    <section className={styles.metrics} aria-label="Chỉ số bệnh viện">
    {indicators.map(item => {
      const value = item.key === "visits" ? fptSummary?.visits ?? data?.metrics.visits
        : item.key === "currentInpatients" ? fptSummary?.inpatients ?? data?.metrics.currentInpatients
        : data?.metrics[item.key];
      return <article className={styles.metric} key={item.key} data-tone={item.tone} title={data?.unavailable[item.key] || item.definition}>
        <div className={styles.metricTop}><span className={styles.metricIcon}><item.icon /></span><span className={styles.metricUnit}>{item.unit}</span></div>
        <h3>{item.label}</h3><div className={styles.metricValue} aria-label={value == null ? "Chưa có dữ liệu" : undefined} title={item.key === "revenue" ? `${number(value)} VNĐ` : undefined}>{item.key === "revenue" ? cashValue(value) : number(value)}</div><span className={styles.metricNote}>{loading ? "Đang tải…" : data ? value == null ? "Chưa đủ dữ liệu nguồn" : item.key === "bedOccupancy" ? `Hiện tại · ${number(data.bedSnapshot?.occupied)}/${number(data.bedSnapshot?.active)} giường` : item.key === "revenue" ? "Đã trừ hoàn trả · gồm tạm ứng" : item.key === "currentInpatients" ? "Tại thời điểm chốt" : "Trong kỳ báo cáo" : "Chưa có số liệu nguồn"}</span>
      </article>;
    })}</section>
    <LiveActivityBoard departmentCharts={<HospitalCharts data={data} period={periodName} section="clinical" />} serviceCharts={<HospitalCharts data={data} period={periodName} section="cls" />} key={key} groups={data?.cls?.byServiceGroup ?? []} departments={data?.departments ?? []} updatedAt={data?.generatedAt} updating={refreshing || loading} stale={Boolean(data && refreshError)} />
    {data && <footer className={styles.reportFooter}><span>Chốt số liệu: {data.asOf.replace("T", " ")} · Bộ nhớ đệm {data.cacheSeconds} giây</span><details><summary>Cách tính số liệu</summary><p>Số liệu tổng hợp từ HIS, cần đối chiếu với báo cáo gốc trước khi dùng làm báo cáo chính thức. Lượt khám tính theo phiếu khám, nhập/xuất viện theo bệnh án có phiếu nhập viện; đang điều trị là số bệnh án chưa ra viện tại thời điểm chốt, không phải tổng trong kỳ. Khoa hiện tại lấy từ lịch sử lưu trú; khoa nhập/xuất theo bệnh án. Công suất giường là tỷ lệ giường đang dùng trên giường không tạm ngưng trong HIS tại thời điểm hiện tại, không phải công suất bình quân ngày giường của kỳ đã chọn. Thực thu gồm chứng từ đã thanh toán và tạm ứng, không hủy, trừ chứng từ hoàn và hoàn hóa đơn theo ngày hoàn; chỉ tính VND. Thực thu theo khoa/phòng được phân theo nơi lập chứng từ.</p>{data.bedSnapshot && <p>Trạng thái giường lúc: {data.bedSnapshot.asOf.replace("T", " ")}</p>}{data.cash && data.cash.invalid === 0 && <p>Đã thu: {number(data.cash.collected)} VNĐ · Hoàn trả: {number(data.cash.refunded)} VNĐ · Thực thu: {number(data.metrics.revenue)} VNĐ</p>}</details></footer>}
  </div>;
}
