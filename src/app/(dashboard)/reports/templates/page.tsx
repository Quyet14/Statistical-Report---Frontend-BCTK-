"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { reportWorkbook } from "@/lib/report-xlsx";
import { getStoredUser } from "@/lib/auth";
import { ManagementDialog } from "@/components/management/ManagementDialog";
type Config = {
  period: string;
  scope: string;
  scopeId?: number;
  columns: string[];
  status?: string;
  priority?: string;
};
type Template = {
  id: number;
  title: string;
  config: Config;
  version: number;
  active: boolean;
};
type Schedule = {
  id: number;
  templateId: number;
  title: string;
  recipients: number[];
  hourVN: number;
  active: boolean;
  version: number;
  nextRun: string;
};
type Job = {
  id: number;
  scheduleId: number;
  state: string;
  attempts: number;
  errorCode: string | null;
  runAt: string;
};
type Preview = {
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
  total: number;
  page: number;
  pageSize: number;
  bounds: { start: string; end: string };
};
type Person = { id: number; name: string };
const periods: Record<string, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
  quarter: "Quý",
  year: "Năm",
};
const initial: Config = {
  period: "month",
  scope: "company",
  columns: ["title", "assignee", "department", "dueDate", "progress", "status"],
};
const jobLabels: Record<string, string> = {
  queued: "Đang chờ",
  running: "Đang gửi",
  completed: "Đã gửi",
  failed: "Gửi thất bại",
};
export default function ReportTemplates() {
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [templates, setTemplates] = useState<Template[]>([]),
    [columns, setColumns] = useState<Record<string, string>>({}),
    [schedules, setSchedules] = useState<Schedule[]>([]),
    [people, setPeople] = useState<Person[]>([]),
    [jobs, setJobs] = useState<Job[]>([]),
    [delivery, setDelivery] = useState(false);
  const [id, setId] = useState<number | null>(null),
    [version, setVersion] = useState(0),
    [title, setTitle] = useState(""),
    [config, setConfig] = useState<Config>(initial),
    [scopeData, setScopeData] = useState<{ scope: string; items: Person[] }>({
      scope: "company",
      items: [],
    }),
    [activeTemplate, setActiveTemplate] = useState(""),
    [date, setDate] = useState(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
        new Date(),
      ),
    ),
    [preview, setPreview] = useState<Preview | null>(null);
  const [recipientIds, setRecipientIds] = useState<number[]>([]),
    [hour, setHour] = useState(7),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [toggle, setToggle] = useState<Schedule | null>(null),
    [drag, setDrag] = useState("");
  async function load() {
    const [list, timing] = await Promise.all([
      api.get<{ items: Template[]; columns: Record<string, string> }>(
        "/reports/builder/templates",
      ),
      api.get<{
        items: Schedule[];
        people: Person[];
        jobs: Job[];
        deliveryEnabled: boolean;
      }>("/reports/builder/schedules"),
    ]);
    setTemplates(list.items);
    setColumns(list.columns);
    setSchedules(timing.items);
    setPeople(timing.people);
    setJobs(timing.jobs);
    setDelivery(timing.deliveryEnabled);
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const capability = await api.get<{ enabled: boolean }>(
          "/reports/builder/capabilities",
        );
        if (!alive) return;
        setEnabled(capability.enabled);
        if (capability.enabled) await load();
      } catch (error) {
        if (alive)
          setMessage(
            error instanceof Error ? error.message : "Không tải được báo cáo.",
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    if (config.scope === "company") return;
    const endpoint = {
      department: "/departments",
      branch: "/branches",
      user: "/users",
    }[config.scope];
    if (endpoint)
      void api
        .get<Person[]>(endpoint)
        .then((items) => {
          if (alive) setScopeData({ scope: config.scope, items });
        })
        .catch(() => {
          if (alive)
            setMessage("Không tải được danh sách phạm vi; hãy thử chọn lại.");
        });
    return () => {
      alive = false;
    };
  }, [config.scope]);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thực hiện được.",
      );
    } finally {
      setBusy(false);
    }
  }
  function move(key: string, direction: number) {
    setConfig((current) => {
      const list = [...current.columns],
        index = list.indexOf(key),
        target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...current, columns: list };
    });
  }
  function edit(template: Template) {
    setId(template.id);
    setVersion(template.version);
    setTitle(template.title);
    setConfig(template.config);
    setMessage("");
  }
  async function show(page = 1) {
    if (!activeTemplate) return;
    await action(async () => {
      setPreview(
        await api.get<Preview>(
          `/reports/builder/templates/${activeTemplate}/preview?date=${date}&page=${page}`,
        ),
      );
    });
  }
  async function download() {
    if (!activeTemplate) return;
    await action(async () => {
      const data = await api.get<Preview>(
          `/reports/builder/templates/${activeTemplate}/export?date=${date}`,
        ),
        bytes = reportWorkbook(
          [
            data.columns.map((column) => column.label),
            ...data.rows.map((row) =>
              data.columns.map((column) => row[column.key]),
            ),
          ],
          {
            title:
              templates.find((item) => String(item.id) === activeTemplate)
                ?.title || "Báo cáo",
            period: data.bounds.start + " — " + data.bounds.end,
            author: getStoredUser()?.name || "",
            layout: "table",
          },
        ),
        blob = new Blob([new Uint8Array(bytes)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "careops-custom-report.xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  return (
    <div className="space-y-5">
      <header className="page-header">
        <div>
          <span className="eyebrow">BÁO CÁO THEO NHU CẦU</span>
          <h1 className="page-title">Mẫu báo cáo & lịch gửi</h1>
        </div>
        <Link className="secondary-action" href="/reports">
          Về báo cáo tổng hợp
        </Link>
      </header>
      {message && (
        <p role="status" className="surface-card p-4">
          {message}
        </p>
      )}
      {enabled === false ? (
        <p className="surface-card p-5">
          Báo cáo tùy chỉnh chưa được bật trên máy chủ.
        </p>
      ) : enabled === null ? (
        <p>Đang kiểm tra…</p>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(260px,1fr)_minmax(0,2fr)]">
            <aside className="surface-card p-5 space-y-3">
              <h2 className="text-xl font-bold">Mẫu đã lưu</h2>
              <button
                className="secondary-action"
                onClick={() => {
                  setId(null);
                  setVersion(0);
                  setTitle("");
                  setConfig(initial);
                }}
              >
                + Tạo mẫu mới
              </button>
              {templates.map((template) => (
                <button
                  key={template.id}
                  className="block w-full rounded-xl border p-3 text-left"
                  onClick={() => edit(template)}
                >
                  <strong>{template.title}</strong>
                  <span className="block text-sm">
                    {periods[template.config.period]} ·{" "}
                    {template.config.columns.length} cột · phiên bản{" "}
                    {template.version}
                    {!template.active ? " · Đã lưu trữ" : ""}
                  </span>
                </button>
              ))}
            </aside>
            <form
              className="surface-card p-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  const saved = await api[id ? "put" : "post"]<{ id: number }>(
                    `/reports/builder/templates${id ? "/" + id : ""}`,
                    { title, config, ...(id ? { version } : {}), active: true },
                  );
                  await load();
                  setId(null);
                  setVersion(0);
                  setTitle("");
                  setConfig(initial);
                  setActiveTemplate(String(saved.id));
                  setPreview(null);
                  setMessage("Đã lưu mẫu báo cáo.");
                });
              }}
            >
              <h2 className="text-xl font-bold">
                {id ? "Chỉnh sửa mẫu" : "Thiết kế mẫu báo cáo"}
              </h2>
              <label className="block">
                Tên mẫu
                <input
                  className="input-field w-full"
                  minLength={3}
                  maxLength={160}
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  Kỳ báo cáo
                  <select
                    className="soft-select w-full"
                    value={config.period}
                    onChange={(event) =>
                      setConfig({ ...config, period: event.target.value })
                    }
                  >
                    {Object.entries(periods).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Phạm vi
                  <select
                    className="soft-select w-full"
                    value={config.scope}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        scope: event.target.value,
                        scopeId: undefined,
                      })
                    }
                  >
                    <option value="company">Toàn bệnh viện</option>
                    <option value="department">Khoa/phòng</option>
                    <option value="branch">Chi nhánh</option>
                    <option value="user">Cá nhân</option>
                  </select>
                </label>
                {config.scope !== "company" && (
                  <label>
                    Đối tượng báo cáo
                    <select
                      className="soft-select w-full"
                      required
                      value={config.scopeId || ""}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          scopeId: Number(event.target.value),
                        })
                      }
                    >
                      <option value="">Chọn đối tượng</option>
                      {(scopeData.scope === config.scope
                        ? scopeData.items
                        : []
                      ).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Trạng thái công việc
                  <select
                    className="soft-select w-full"
                    value={config.status || ""}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        status: event.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Tất cả</option>
                    <option value="todo">Chưa bắt đầu</option>
                    <option value="doing">Đang làm</option>
                    <option value="done">Hoàn thành</option>
                  </select>
                </label>
                <label>
                  Ưu tiên
                  <select
                    className="soft-select w-full"
                    value={config.priority || ""}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        priority: event.target.value || undefined,
                      })
                    }
                  >
                    <option value="">Tất cả</option>
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                  </select>
                </label>
              </div>
              <fieldset>
                <legend className="font-bold">Các cột hiển thị</legend>
                <div className="flex flex-wrap gap-3 py-3">
                  {Object.entries(columns).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.columns.includes(key)}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            columns: event.target.checked
                              ? [...config.columns, key]
                              : config.columns.filter((item) => item !== key),
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-sm">
                Kéo để sắp xếp thứ tự cột, hoặc sử dụng nút lên/xuống.
              </p>
              <ol className="space-y-2">
                {config.columns.map((key, index) => (
                  <li
                    key={key}
                    draggable
                    onDragStart={() => setDrag(key)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      setConfig((current) => {
                        const list = current.columns.filter(
                          (item) => item !== drag,
                        );
                        if (!drag || !current.columns.includes(drag))
                          return current;
                        list.splice(index, 0, drag);
                        return { ...current, columns: list };
                      });
                      setDrag("");
                    }}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <span>
                      {index + 1}. {columns[key]}
                    </span>
                    <div>
                      <button
                        type="button"
                        aria-label={`Đưa ${columns[key]} lên`}
                        className="secondary-action"
                        disabled={!index}
                        onClick={() => move(key, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Đưa ${columns[key]} xuống`}
                        className="secondary-action"
                        disabled={index === config.columns.length - 1}
                        onClick={() => move(key, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              <button
                className="primary-action"
                disabled={busy || !config.columns.length}
              >
                {busy ? "Đang lưu…" : "Lưu mẫu báo cáo"}
              </button>
            </form>
          </div>
          <section className="surface-card p-5 space-y-4">
            <h2 className="text-xl font-bold">Xem trước & xuất Excel</h2>
            <div className="flex flex-wrap gap-3">
              <label>
                Mẫu báo cáo
                <select
                  className="soft-select block"
                  value={activeTemplate}
                  onChange={(event) => {
                    setActiveTemplate(event.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">Chọn mẫu</option>
                  {templates
                    .filter((template) => template.active)
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Ngày trong kỳ
                <input
                  className="input-field block"
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setPreview(null);
                  }}
                />
              </label>
              <button
                className="secondary-action"
                disabled={busy || !activeTemplate || !date}
                onClick={() => show()}
              >
                Xem trước
              </button>
              <button
                className="primary-action"
                disabled={busy || !activeTemplate || !date}
                onClick={download}
              >
                Tải Excel
              </button>
            </div>
            {preview && (
              <>
                <p>
                  {preview.bounds.start} — {preview.bounds.end} ·{" "}
                  {preview.total} công việc
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        {preview.columns.map((column) => (
                          <th className="border-b p-3" key={column.key}>
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, index) => (
                        <tr key={index}>
                          {preview.columns.map((column) => (
                            <td className="border-b p-3" key={column.key}>
                              {row[column.key] ?? "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!preview.rows.length && (
                    <p className="p-4">
                      Chưa có công việc phù hợp trong kỳ này.
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    className="secondary-action"
                    disabled={busy || preview.page === 1}
                    onClick={() => show(preview.page - 1)}
                  >
                    Trang trước
                  </button>
                  <span>Trang {preview.page}</span>
                  <button
                    className="secondary-action"
                    disabled={
                      busy || preview.page * preview.pageSize >= preview.total
                    }
                    onClick={() => show(preview.page + 1)}
                  >
                    Trang sau
                  </button>
                </div>
              </>
            )}
          </section>
          <section className="surface-card p-5 space-y-4">
            <h2 className="text-xl font-bold">Gửi báo cáo theo lịch</h2>
            <p>
              Gửi kỳ đã kết thúc vào đầu kỳ kế tiếp, theo giờ Việt Nam. Chỉ chọn
              quản trị viên đang hoạt động. Lịch mới được tạo ở trạng thái tắt.
            </p>
            {!delivery && (
              <p className="workflow-alert">
                Bộ gửi tự động hiện đang tắt. Bạn có thể chuẩn bị lịch, chưa có
                email nào được gửi.
              </p>
            )}
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void action(async () => {
                  await api.post("/reports/builder/schedules", {
                    templateId: Number(activeTemplate),
                    recipients: recipientIds,
                    hourVN: hour,
                    active: false,
                  });
                  await load();
                  setRecipientIds([]);
                  setMessage(
                    "Đã tạo lịch ở trạng thái tắt. Kiểm tra người nhận trước khi bật.",
                  );
                });
              }}
            >
              <label>
                Mẫu sẽ gửi
                <select
                  className="soft-select block"
                  required
                  value={activeTemplate}
                  onChange={(event) => {
                    setActiveTemplate(event.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">Chọn mẫu</option>
                  {templates
                    .filter((template) => template.active)
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Giờ gửi (Việt Nam)
                <input
                  className="input-field block"
                  type="number"
                  min={0}
                  max={23}
                  required
                  value={hour}
                  onChange={(event) => setHour(Number(event.target.value))}
                />
              </label>
              <fieldset>
                <legend>Người nhận</legend>
                <div className="flex flex-wrap gap-4">
                  {people.map((person) => (
                    <label key={person.id} className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={recipientIds.includes(person.id)}
                        onChange={(event) =>
                          setRecipientIds((previous) =>
                            event.target.checked
                              ? [...previous, person.id]
                              : previous.filter((id) => id !== person.id),
                          )
                        }
                      />
                      {person.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                className="primary-action"
                disabled={busy || !activeTemplate || !recipientIds.length}
              >
                Tạo lịch gửi
              </button>
            </form>
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="rounded-xl border p-4">
                  <strong>{schedule.title}</strong>
                  <p>
                    {schedule.active ? "Đang bật" : "Đang tắt"} ·{" "}
                    {schedule.hourVN}:00 giờ Việt Nam ·{" "}
                    {schedule.recipients.length} người nhận · Lần kế tiếp{" "}
                    {String(schedule.nextRun).replace("T", " ").slice(0, 19)}
                  </p>
                  <button
                    className="secondary-action"
                    disabled={busy}
                    onClick={() => setToggle(schedule)}
                  >
                    {schedule.active ? "Tắt lịch" : "Kiểm tra & bật lịch"}
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="surface-card p-5 space-y-3">
            <h2 className="text-xl font-bold">Theo dõi các lần gửi</h2>
            {!jobs.length ? (
              <p>Chưa có lần gửi nào.</p>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap justify-between gap-3 border-b py-3"
                >
                  <span>
                    #{job.id} · Lịch #{job.scheduleId} ·{" "}
                    {jobLabels[job.state] || job.state}
                  </span>
                  <span>
                    {job.attempts} lần thử{" "}
                    {job.errorCode ? `· ${job.errorCode}` : ""}
                  </span>
                </div>
              ))
            )}
          </section>
        </>
      )}
      {toggle && (
        <ManagementDialog
          title={
            toggle.active ? "Tắt lịch gửi báo cáo" : "Bật lịch gửi báo cáo"
          }
          busy={busy}
          onClose={() => setToggle(null)}
        >
          <p>
            {toggle.title} · {toggle.hourVN}:00 giờ Việt Nam
          </p>
          <p>
            Người nhận:{" "}
            {toggle.recipients
              .map(
                (id) =>
                  people.find((person) => person.id === id)?.name ||
                  "Tài khoản không còn đủ quyền",
              )
              .join(", ")}
          </p>
          <p>
            {toggle.active
              ? "Các lần gửi chưa xử lý sẽ dừng theo lịch đã tắt."
              : "Mỗi đầu kỳ, hệ thống gửi file Excel của kỳ đã kết thúc. Backend kiểm tra lại quyền trước khi gửi."}
          </p>
          <button
            className="primary-action"
            disabled={busy || (!toggle.active && !delivery)}
            onClick={() =>
              action(async () => {
                await api.put("/reports/builder/schedules/" + toggle.id, {
                  templateId: toggle.templateId,
                  recipients: toggle.recipients,
                  hourVN: toggle.hourVN,
                  active: !toggle.active,
                  version: toggle.version,
                });
                await load();
                setToggle(null);
                setMessage("Đã cập nhật trạng thái lịch gửi.");
              })
            }
          >
            Xác nhận {toggle.active ? "tắt" : "bật"} lịch
          </button>
        </ManagementDialog>
      )}
    </div>
  );
}
