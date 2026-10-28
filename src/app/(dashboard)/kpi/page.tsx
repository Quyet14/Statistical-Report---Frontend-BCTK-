"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SummaryCard } from "@/components/common/SummaryCard";
import { TeamOutlined, RiseOutlined, TrophyOutlined } from "@ant-design/icons";
import { getStoredUser } from "@/lib/auth";

const clampScore = (value: unknown) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.round(score));
};

type KpiRankingItem = {
  id?: number;
  userId?: number;
  name?: string;
  department?: string | null;
  departmentId?: number | null;
  score?: number;
};

type Department = {
  id: number;
  name: string;
};

export default function KpiPage() {
  const [data, setData] = useState<{ rank: number; staff: string; department: string; kpi: number; progress: number }[]>([]);
  const [scopeLabel, setScopeLabel] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const currentUser = getStoredUser();
        const isAdmin = currentUser?.role.toLowerCase() === "admin";
        if (!isAdmin && currentUser?.role.toLowerCase() !== "manager") return;
        if (!isAdmin && currentUser?.departmentId == null) {
          setScopeLabel("Chưa được gán khoa/phòng");
          return;
        }
        const [ranking, departments] = await Promise.all([
          api.get<KpiRankingItem[]>("/kpi/ranking?period=month"),
          api.get<Department[]>("/departments"),
        ]);

        if (Array.isArray(ranking)) {
          const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
          // The API enforces scope; also refuse unscoped rows for department heads.
          const visibleRanking = isAdmin ? ranking : ranking.filter((item) => item.departmentId != null && Number(item.departmentId) === Number(currentUser?.departmentId));
          const normalized = visibleRanking.map((item, index) => {
            const department =
              item.department ??
              (item.departmentId == null ? undefined : departmentNames.get(Number(item.departmentId))) ??
              "Chưa có phòng ban";

            return {
              rank: index + 1,
              staff: item.name ?? `Nhân sự ${index + 1}`,
              department,
              kpi: clampScore(item.score),
              progress: Math.min(clampScore(item.score), 100),
            };
          });
          if (!cancelled) {
            setData(normalized);
            setScopeLabel(isAdmin ? "Toàn bệnh viện" : departmentNames.get(Number(currentUser?.departmentId)) ?? "Khoa/phòng của bạn");
          }
        }
      } catch {
        if (!cancelled) { setData([]); setError("Không thể tải bảng KPI. Vui lòng tải lại trang để thử lại."); }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="dashboard-page" data-page="kpi">
      <div className="page-header">
        <div>
          <span className="eyebrow">Hiệu suất</span>
          <h3 className="page-title">Xếp hạng KPI</h3>
          <p className="page-description">Ghi nhận đóng góp, theo dõi hiệu suất và cùng đội ngũ tiến bộ mỗi ngày.</p>
        </div>
        {scopeLabel ? <span className="status-badge success">{scopeLabel}</span> : null}
      </div>
      {error ? <div className="auth-alert auth-alert-error" role="alert">{error}</div> : null}

      <div className="stats-grid">
        <SummaryCard label="Nhân sự xếp hạng" value={data.length} tone="blue" icon={<TeamOutlined />} />
        <SummaryCard label="KPI trung bình" value={data.length ? Math.round(data.reduce((sum, row) => sum + row.kpi, 0) / data.length) : "—"} tone="violet" icon={<RiseOutlined />} />
        <SummaryCard label="Đạt từ 100 điểm" value={data.filter((row) => row.kpi >= 100).length} tone="green" icon={<TrophyOutlined />} />
      </div>
      <div className="panel-card table-card kpi-table">
        <div className="section-header"><h4>Bảng xếp hạng tháng</h4><span>{data.length} nhân sự</span></div>
        <table className="modern-table">
          <thead>
            <tr>
              <th>Hạng</th>
              <th>Nhân sự</th>
              <th>Phòng ban</th>
              <th>KPI</th>
              <th>Tiến độ</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={`${row.staff}-${row.rank}`}>
                <td><span className={`rank-badge rank-${row.rank <= 3 ? row.rank : "other"}`}>{row.rank}</span></td>
                <td><span className="staff-cell"><span className="staff-avatar" aria-hidden="true">{row.staff.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase()}</span><span>{row.staff}</span></span></td>
                <td>{row.department}</td>
                <td>{row.kpi}</td>
                <td>
                  <div className="ranking-progress"><span>{row.progress}%</span><div className="mini-progress" role="progressbar" aria-label={`Tiến độ ${row.staff}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.progress}>
                    <span style={{ width: `${row.progress}%` }} />
                  </div></div>
                </td>
              </tr>
            ))}
            {!data.length ? <tr><td colSpan={5} className="empty-table-state">Chưa có dữ liệu xếp hạng trong tháng này.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
