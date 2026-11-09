"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SummaryCard } from "@/components/common/SummaryCard";
import { TeamOutlined, RiseOutlined, TrophyOutlined } from "@ant-design/icons";
import { getStoredUser } from "@/lib/auth";
import Link from "next/link";
import { ManagementDialog } from "@/components/management/ManagementDialog";
import { useFeedback } from "@/context/FeedbackContext";

const clampScore = (value: unknown) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.round(score * 100) / 100);
};

type KpiRankingItem = {
  id?: number;
  userId?: number;
  name?: string;
  department?: string | null;
  departmentId?: number | null;
  score?: number;
  totalCount?: number;
  completedCount?: number;
  lateCount?: number;
  provisional?: boolean;
  frozen?: boolean;
  policyTitle?: string;
};

type Department = {
  id: number;
  name: string;
};

const getLocalDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export default function KpiPage() {
  const [data, setData] = useState<
    {
      userId: number;
      rank: number;
      staff: string;
      department: string;
      kpi: number;
      progress: number;
      totalCount: number;
      completedCount: number;
      lateCount: number;
      provisional: boolean;
      frozen: boolean;
      policyTitle: string;
    }[]
  >([]);
  const user = getStoredUser();
  const [policiesEnabled, setPoliciesEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState<{
    name: string;
    items: {
      id: number;
      periodType: string;
      periodValue: string;
      result: {
        score: number;
        policyTitle?: string;
        completedCount?: number;
        totalCount?: number;
      };
    }[];
  } | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const { runAction } = useFeedback();
  const [scopeLabel, setScopeLabel] = useState("");
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter" | "year">("month");
  const [selectedDate, setSelectedDate] = useState(getLocalDate);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setData([]);
    const load = async () => {
      try {
        const currentUser = getStoredUser();
        const isAdmin =
          !!currentUser && ["admin", "viewer"].includes(currentUser.role);
        if (
          !isAdmin &&
          !["manager", "leader"].includes(currentUser?.role ?? "")
        )
          return;
        if (!isAdmin && currentUser?.departmentId == null) {
          setScopeLabel("Chưa được gán khoa/phòng");
          return;
        }
        const params = new URLSearchParams({ period, date: selectedDate });
        const [ranking, departments, capabilities] = await Promise.all([
          api.get<KpiRankingItem[]>(`/kpi/ranking?${params}`),
          api.get<Department[]>("/departments"),
          api
            .get<{ policies?: boolean }>("/kpi/capabilities")
            .catch(() => ({ policies: false })),
        ]);
        if (!cancelled) setPoliciesEnabled(capabilities.policies === true);

        if (Array.isArray(ranking)) {
          const departmentNames = new Map(
            departments.map((department) => [department.id, department.name]),
          );
          // The API enforces scope; also refuse unscoped rows for department heads.
          const visibleRanking = isAdmin
            ? ranking
            : ranking.filter(
                (item) =>
                  item.departmentId != null &&
                  Number(item.departmentId) ===
                    Number(currentUser?.departmentId),
              );
          const normalized = visibleRanking.map((item, index) => {
            const department =
              item.department ??
              (item.departmentId == null
                ? undefined
                : departmentNames.get(Number(item.departmentId))) ??
              "Chưa có phòng ban";

            return {
              rank: index + 1,
              userId: Number(item.userId ?? item.id),
              staff: item.name ?? `Nhân sự ${index + 1}`,
              department,
              kpi: clampScore(item.score),
              progress: Math.min(clampScore(item.score), 100),
              totalCount: Number(item.totalCount ?? 0),
              completedCount: Number(item.completedCount ?? 0),
              lateCount: Number(item.lateCount ?? 0),
              provisional: !!item.provisional,
              frozen: !!item.frozen,
              policyTitle: item.policyTitle ?? "Tỷ lệ hoàn thành",
            };
          });
          if (!cancelled) {
            setData(normalized);
            setScopeLabel(
              isAdmin
                ? "Toàn bệnh viện"
                : (departmentNames.get(Number(currentUser?.departmentId)) ??
                    "Khoa/phòng của bạn"),
            );
          }
        }
      } catch {
        if (!cancelled) {
          setData([]);
          setError(
            "Không thể tải bảng KPI. Vui lòng tải lại trang để thử lại.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [period, selectedDate, reload]);

  const periodLabel =
    ({day:"ngày",week:"tuần",month:"tháng",quarter:"quý",year:"năm"}[period]);

  return (
    <div className="dashboard-page" data-page="kpi">
      <div className="page-header">
        <div>
          <span className="eyebrow">Hiệu suất</span>
          <h3 className="page-title">Xếp hạng KPI</h3>
        </div>
        {scopeLabel ? (
          <span className="status-badge success">{scopeLabel}</span>
        ) : null}
        <div className="toolbar">
          {policiesEnabled &&
          user &&
          ["admin", "manager"].includes(user.role) ? (
            <Link className="secondary-action" href="/kpi/policies">
              Công thức & chỉ tiêu
            </Link>
          ) : null}
          {policiesEnabled && user?.role === "admin" ? (
            <button
              className="secondary-action"
              disabled={loading || !!error || !data.length || period === "day"}
              onClick={() => setConfirmFreeze(true)}
            >
              Chốt kỳ KPI
            </button>
          ) : null}
          <label>
            Kỳ KPI
            <select
              aria-label="Kỳ KPI"
              className="soft-select"
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as typeof period)
              }
            >
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option><option value="quarter">Quý</option><option value="year">Năm</option>
            </select>
          </label>
          <label>
            Mốc ngày
            <input
              className="date-input"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        </div>
      </div>
      {error ? (
        <div className="auth-alert auth-alert-error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p role="status">Đang tổng hợp KPI…</p> : null}
      {data.some((row) => row.provisional) ? (
        <p className="workflow-alert">
          Có điểm tạm tính vì thiếu ngày hoàn thành; cần đủ dữ liệu trước khi
          chốt kỳ.
        </p>
      ) : null}

      <div className="stats-grid">
        <SummaryCard
          label="Nhân sự xếp hạng"
          value={data.length}
          tone="blue"
          icon={<TeamOutlined />}
        />
        <SummaryCard
          label="KPI trung bình"
          value={
            data.length
              ? Math.round(
                  data.reduce((sum, row) => sum + row.kpi, 0) / data.length,
                )
              : "—"
          }
          tone="violet"
          icon={<RiseOutlined />}
        />
        <SummaryCard
          label="Đạt từ 100 điểm"
          value={data.filter((row) => row.kpi >= 100).length}
          tone="green"
          icon={<TrophyOutlined />}
        />
      </div>
      <div className="panel-card table-card kpi-table">
        <div className="section-header">
          <h4>Bảng xếp hạng theo {periodLabel}</h4>
          <span>{data.length} nhân sự</span>
        </div>
        <table className="modern-table">
          <thead>
            <tr>
              <th>Hạng</th>
              <th>Nhân sự</th>
              <th>Phòng ban</th>
              <th>KPI</th>
              <th>Hoàn thành / Tổng</th>
              <th>Trễ hạn</th>
              <th>Tiến độ</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={`${row.staff}-${row.rank}`}>
                <td>
                  <span
                    className={`rank-badge rank-${row.rank <= 3 ? row.rank : "other"}`}
                  >
                    {row.rank}
                  </span>
                </td>
                <td>
                  <span className="staff-cell">
                    <span className="staff-avatar" aria-hidden="true">
                      {row.staff
                        .trim()
                        .split(/\s+/)
                        .slice(-1)[0]?.[0]
                        ?.toUpperCase()}
                    </span>
                    {policiesEnabled ? (
                      <button
                        className="table-title-button"
                        disabled={historyBusy}
                        onClick={async () => {
                          setHistoryBusy(true);
                          try {
                            const items = await api.get<
                              NonNullable<typeof history>["items"]
                            >(`/kpi/history/${row.userId}`);
                            setHistory({ name: row.staff, items });
                          } catch (reason) {
                            setError(
                              reason instanceof Error
                                ? reason.message
                                : "Không tải được lịch sử KPI.",
                            );
                          } finally {
                            setHistoryBusy(false);
                          }
                        }}
                      >
                        {row.staff}
                      </button>
                    ) : (
                      <span>{row.staff}</span>
                    )}
                  </span>
                </td>
                <td>{row.department}</td>
                <td>
                  {row.kpi}
                  <small>
                    {row.provisional
                      ? "Tạm tính"
                      : row.frozen
                        ? "Đã chốt"
                        : row.policyTitle}
                  </small>
                </td>
                <td>
                  {row.completedCount} / {row.totalCount}
                </td>
                <td>{row.lateCount}</td>
                <td>
                  <div className="ranking-progress">
                    <span>{row.progress}%</span>
                    <div
                      className="mini-progress"
                      role="progressbar"
                      aria-label={`Tiến độ ${row.staff}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={row.progress}
                    >
                      <span style={{ width: `${row.progress}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !data.length ? (
              <tr>
                <td colSpan={7} className="empty-table-state">
                  Chưa có dữ liệu xếp hạng trong {periodLabel} đã chọn.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {history ? (
        <ManagementDialog
          title={`Lịch sử KPI · ${history.name}`}
          busy={false}
          onClose={() => setHistory(null)}
        >
          <div className="kpi-history-list">
            {history.items.map((item) => (
              <article key={item.id}>
                <strong>
                  {({week:"Tuần",month:"Tháng",quarter:"Quý",year:"Năm"} as Record<string,string>)[item.periodType]??item.periodType} bắt đầu{" "}
                  {String(item.periodValue).slice(0, 10)} ·{" "}
                  {clampScore(item.result.score)} điểm
                </strong>
                <p>{item.result.policyTitle ?? "Tỷ lệ hoàn thành"}</p>
                <p>
                  {item.result.completedCount ?? 0}/
                  {item.result.totalCount ?? 0} công việc hoàn thành · Đã chốt
                </p>
              </article>
            ))}
            {!history.items.length ? (
              <p className="workflow-empty">
                Chưa có kỳ KPI đã chốt cho nhân sự này.
              </p>
            ) : null}
          </div>
        </ManagementDialog>
      ) : null}
      {confirmFreeze ? (
        <ManagementDialog
          title="Chốt số liệu kỳ KPI?"
          busy={freezing}
          onClose={() => setConfirmFreeze(false)}
        >
          <p>
            Kỳ {periodLabel} chứa ngày {selectedDate} sẽ lưu điểm và công thức
            hiện tại. Chỉ chốt kỳ đã kết thúc và đủ dữ liệu; số liệu đã chốt
            không bị ghi đè.
          </p>
          <div className="management-dialog-actions">
            <button
              className="secondary-action"
              disabled={freezing}
              onClick={() => setConfirmFreeze(false)}
            >
              Hủy
            </button>
            <button
              className="primary-action"
              disabled={freezing}
              onClick={async () => {
                setFreezing(true);
                try {
                  const result = await runAction(
                    () =>
                      api.post<{ created: number; existing: number }>(
                        "/kpi/snapshots",
                        { period, date: selectedDate },
                      ),
                    (value) => ({
                      title: "Đã chốt kỳ KPI",
                      description: `${value.created} kết quả mới · ${value.existing} kết quả đã có`,
                    }),
                  );
                  if (result.ok) {
                    setConfirmFreeze(false);
                    setReload((v) => v + 1);
                  }
                } finally {
                  setFreezing(false);
                }
              }}
            >
              {freezing ? "Đang chốt…" : "Xác nhận chốt kỳ"}
            </button>
          </div>
        </ManagementDialog>
      ) : null}
    </div>
  );
}
