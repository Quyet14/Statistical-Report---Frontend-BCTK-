"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useFeedback } from "@/context/FeedbackContext";
import { ManagementDialog } from "@/components/management/ManagementDialog";
type Config = {
  completionWeight: number;
  onTimeWeight: number;
  volumeWeight: number;
  target: number;
  low: number;
  medium: number;
  high: number;
};
type Policy = {
  id: number;
  title: string;
  departmentId: number;
  position: string;
  periodType: string;
  effectiveFrom: string;
  config: Config;
  version: number;
};
type Person = {
  id: number;
  name: string;
  departmentId: number;
  position?: string;
};
type Data = {
  policies: Policy[];
  departments: { id: number; name: string }[];
  people: Person[];
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const initial = {
  title: "",
  departmentId: "0",
  position: "*",
  periodType: "month",
  effectiveFrom: today(),
  config: {
    completionWeight: 70,
    onTimeWeight: 20,
    volumeWeight: 10,
    target: 20,
    low: 1,
    medium: 1.5,
    high: 2,
  },
};
export default function KpiPoliciesPage() {
  const user = getStoredUser(),
    canManage = !!user && ["admin", "manager"].includes(user.role),
    isAdmin = user?.role === "admin";
  const [data, setData] = useState<Data>({
    policies: [],
    departments: [],
    people: [],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [positions, setPositions] = useState<Record<number, string>>({});
  const { runAction } = useFeedback();
  useEffect(() => {
    let alive = true;
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void api
      .get<Data>("/kpi/policies")
      .then((value) => {
        if (alive) {
          setData(value);
          setPositions(
            Object.fromEntries(
              value.people.map((p) => [p.id, p.position ?? ""]),
            ),
          );
        }
      })
      .catch((reason) => {
        if (alive)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được cấu hình KPI.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reload, canManage]);
  const total =
    form.config.completionWeight +
    form.config.onTimeWeight +
    form.config.volumeWeight;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || Math.abs(total - 100) > 0.001) return;
    setBusy(true);
    try {
      const result = await runAction(
        () =>
          api.post("/kpi/policies", {
            ...form,
            departmentId: Number(form.departmentId),
            position: form.position.trim() || "*",
          }),
        { title: "Đã lưu phiên bản công thức KPI", description: form.title },
      );
      if (result.ok) {
        setOpen(false);
        setReload((v) => v + 1);
      }
    } finally {
      setBusy(false);
    }
  }
  function changeConfig(key: keyof Config, value: string) {
    setForm((current) => ({
      ...current,
      config: { ...current.config, [key]: Number(value) },
    }));
  }
  if (!canManage)
    return (
      <div className="panel-card workflow-empty">
        Bạn không có quyền cấu hình KPI.{" "}
        <Link href="/kpi">Quay lại bảng KPI</Link>
      </div>
    );
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Đánh giá minh bạch</span>
          <h3 className="page-title">Công thức & chỉ tiêu KPI</h3>
        </div>
        <div className="toolbar">
          <Link className="secondary-action" href="/kpi">
            Bảng KPI
          </Link>
          <button
            className="primary-action"
            disabled={loading || !!error}
            onClick={() => {
              setForm({
                ...initial,
                effectiveFrom: today(),
                departmentId: isAdmin ? "0" : String(user?.departmentId ?? ""),
              });
              setOpen(true);
            }}
          >
            + Tạo phiên bản công thức
          </button>
        </div>
      </div>
      {error ? (
        <div role="alert" className="workflow-alert">
          {error}
          <button
            className="secondary-action"
            onClick={() => setReload((v) => v + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : null}
      {loading ? <p role="status">Đang tải cấu hình…</p> : null}
      <section className="panel-card kpi-policy-explainer">
        <strong>Cách tính điểm</strong>
        <p>
          Điểm = tỷ lệ hoàn thành có trọng số × trọng số hoàn thành + tỷ lệ đúng
          hạn × trọng số đúng hạn + mức đạt chỉ tiêu khối lượng × trọng số khối
          lượng.
        </p>
        <p>
          Công thức cho vị trí cụ thể được ưu tiên trong khoa. Chưa có công thức
          riêng sẽ dùng tỷ lệ hoàn thành. Khi thiếu ngày hoàn thành, điểm có
          thành phần đúng hạn được đánh dấu tạm tính và chưa được chốt.
        </p>
      </section>
      <div className="kpi-policy-grid">
        {data.policies.map((policy) => (
          <article className="panel-card kpi-policy-card" key={policy.id}>
            <div className="section-header">
              <span className="workflow-state approved">
                Phiên bản {policy.version}
              </span>
              <small>
                {({week:"Theo tuần",month:"Theo tháng",quarter:"Theo quý",year:"Theo năm"} as Record<string,string>)[policy.periodType]}
              </small>
            </div>
            <h4>{policy.title}</h4>
            <p>
              {policy.departmentId === 0
                ? "Toàn bệnh viện"
                : (data.departments.find((d) => d.id === policy.departmentId)
                    ?.name ?? "Khoa/phòng")}{" "}
              · {policy.position === "*" ? "Mọi vị trí" : policy.position}
            </p>
            <dl>
              <div>
                <dt>Hoàn thành / Đúng hạn / Khối lượng</dt>
                <dd>
                  {policy.config.completionWeight}% /{" "}
                  {policy.config.onTimeWeight}% / {policy.config.volumeWeight}%
                </dd>
              </div>
              <div>
                <dt>Chỉ tiêu khối lượng</dt>
                <dd>
                  {policy.config.target} đơn vị /{" "}
                  {({week:"tuần",month:"tháng",quarter:"quý",year:"năm"} as Record<string,string>)[policy.periodType]}
                </dd>
              </div>
              <div>
                <dt>Hệ số Thấp / Vừa / Cao</dt>
                <dd>
                  {policy.config.low} / {policy.config.medium} /{" "}
                  {policy.config.high}
                </dd>
              </div>
            </dl>
            <small>
              Áp dụng từ {policy.effectiveFrom.split("-").reverse().join("/")}.
              Kỳ chưa chốt sử dụng cấu hình có hiệu lực phù hợp.
            </small>
          </article>
        ))}
      </div>
      {!loading && !error && !data.policies.length ? (
        <div className="panel-card workflow-empty">
          Chưa có công thức riêng. KPI đang dùng tỷ lệ hoàn thành.
        </div>
      ) : null}
      <section className="panel-card table-card">
        <div className="section-header">
          <h4>Vị trí chấm KPI của nhân sự</h4>
          <small>Gắn vị trí để áp dụng chỉ tiêu tương ứng</small>
        </div>
        <div className="workflow-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Khoa/phòng</th>
                <th>Vị trí</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.people.map((person) => (
                <tr key={person.id}>
                  <td>{person.name}</td>
                  <td>
                    {data.departments.find((d) => d.id === person.departmentId)
                      ?.name ?? "Chưa phân khoa"}
                  </td>
                  <td>
                    <input
                      className="auth-input"
                      aria-label={`Vị trí KPI của ${person.name}`}
                      maxLength={100}
                      value={positions[person.id] ?? ""}
                      onChange={(e) =>
                        setPositions({
                          ...positions,
                          [person.id]: e.target.value,
                        })
                      }
                      placeholder="Ví dụ: Điều dưỡng"
                    />
                  </td>
                  <td>
                    <button
                      className="secondary-action"
                      disabled={
                        busy ||
                        (positions[person.id] ?? "") === (person.position ?? "")
                      }
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const result = await runAction(
                            () =>
                              api.put(`/kpi/assignments/${person.id}`, {
                                position: positions[person.id] ?? "",
                              }),
                            {
                              title: "Đã lưu vị trí chấm KPI",
                              description: person.name,
                            },
                          );
                          if (result.ok) setReload((v) => v + 1);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Lưu vị trí
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {open ? (
        <ManagementDialog
          title="Phiên bản công thức KPI mới"
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <form className="management-form" onSubmit={save}>
            <label>
              Tên công thức
              <input
                required
                autoFocus
                maxLength={150}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className="management-form-row">
              <label>
                Khoa/phòng
                <select
                  required
                  value={form.departmentId}
                  onChange={(e) =>
                    setForm({ ...form, departmentId: e.target.value })
                  }
                >
                  {isAdmin ? <option value="0">Toàn bệnh viện</option> : null}
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vị trí áp dụng
                <input
                  required
                  maxLength={100}
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                  placeholder="* = mọi vị trí"
                />
              </label>
            </div>
            <div className="management-form-row">
              <label>
                Kỳ đánh giá
                <select
                  value={form.periodType}
                  onChange={(e) =>
                    setForm({ ...form, periodType: e.target.value })
                  }
                >
                  <option value="month">Tháng</option><option value="quarter">Quý</option><option value="year">Năm</option>
                  <option value="week">Tuần</option>
                </select>
              </label>
              <label>
                Áp dụng từ
                <input
                  type="date"
                  required
                  min={today()}
                  value={form.effectiveFrom}
                  onChange={(e) =>
                    setForm({ ...form, effectiveFrom: e.target.value })
                  }
                />
              </label>
            </div>
            <fieldset className="kpi-policy-fieldset">
              <legend>Trọng số điểm (tổng 100%)</legend>
              <div className="kpi-policy-three">
                {(
                  [
                    ["completionWeight", "Hoàn thành (%)"],
                    ["onTimeWeight", "Đúng hạn (%)"],
                    ["volumeWeight", "Khối lượng (%)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      step="0.1"
                      value={form.config[key]}
                      onChange={(e) => changeConfig(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <p
                role="status"
                className={
                  Math.abs(total - 100) < 0.001 ? "" : "kpi-policy-error"
                }
              >
                Tổng trọng số: {total.toFixed(1)}%
              </p>
            </fieldset>
            <fieldset className="kpi-policy-fieldset">
              <legend>Khối lượng theo mức ưu tiên</legend>
              <div className="kpi-policy-three">
                {(
                  [
                    ["low", "Thấp"],
                    ["medium", "Vừa"],
                    ["high", "Cao"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      required
                      min={0.25}
                      max={10}
                      step="0.25"
                      value={form.config[key]}
                      onChange={(e) => changeConfig(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Chỉ tiêu khối lượng trong kỳ
              <input
                type="number"
                min={form.config.volumeWeight > 0 ? 0.25 : 0}
                max={100000}
                step="0.25"
                required
                value={form.config.target}
                onChange={(e) => changeConfig("target", e.target.value)}
              />
            </label>
            <p className="management-scope-note">
              Một công việc hoàn thành đóng góp khối lượng bằng hệ số mức ưu
              tiên. Đạt/vượt chỉ tiêu được tối đa 100 điểm thành phần. Ngày áp
              dụng không được ở quá khứ.
            </p>
            <div className="management-dialog-actions">
              <button
                className="secondary-action"
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <button
                className="primary-action"
                disabled={
                  busy ||
                  Math.abs(total - 100) > 0.001 ||
                  (form.config.volumeWeight > 0 && form.config.target <= 0)
                }
              >
                {busy ? "Đang lưu…" : "Lưu phiên bản"}
              </button>
            </div>
          </form>
        </ManagementDialog>
      ) : null}
    </div>
  );
}
