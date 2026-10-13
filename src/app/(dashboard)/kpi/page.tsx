"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

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
  score?: number;
};

type KpiUser = {
  id: number;
  departmentId?: number | null;
  departmentName?: string | null;
  department?: string | null;
};

type Department = {
  id: number;
  name: string;
};

export default function KpiPage() {
  const [data, setData] = useState<{ rank: number; staff: string; department: string; kpi: number; progress: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [ranking, users, departments] = await Promise.all([
          api.get<KpiRankingItem[]>("/kpi/ranking?period=month"),
          api.get<KpiUser[]>("/users"),
          api.get<Department[]>("/departments"),
        ]);

        if (Array.isArray(ranking)) {
          const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
          const usersById = new Map(users.map((user) => [user.id, user]));

          const normalized = ranking.map((item, index) => {
            const user = item.userId == null ? undefined : usersById.get(item.userId);
            const department =
              item.department ??
              user?.departmentName ??
              user?.department ??
              (user?.departmentId == null ? undefined : departmentNames.get(user.departmentId)) ??
              "Chưa có phòng ban";

            return {
              rank: index + 1,
              staff: item.name ?? `Nhân sự ${index + 1}`,
              department,
              kpi: clampScore(item.score),
              progress: Math.min(clampScore(item.score), 100),
            };
          });
          setData(normalized);
        }
      } catch (error) {
        console.warn("KPI API unavailable.", error);
      }
    };

    void load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Hiệu suất</span>
          <h3 className="page-title">Xếp hạng KPI</h3>
        </div>
      </div>

      <div className="panel-card table-card">
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
                <td>{row.rank}</td>
                <td>{row.staff}</td>
                <td>{row.department}</td>
                <td>{row.kpi}</td>
                <td>
                  <div className="mini-progress">
                    <span style={{ width: `${row.progress}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
