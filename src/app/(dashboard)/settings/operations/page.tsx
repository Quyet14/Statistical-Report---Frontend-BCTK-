"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ManagementDialog } from "@/components/management/ManagementDialog";
type Policy = {
  enabled: boolean;
  hourVN: number;
  retentionDays: number;
  nextRun: string;
};
type Job = {
  id: string;
  kind: string;
  parentId: string | null;
  state: string;
  errorCode: string | null;
  finishedAt: string | null;
  summary: {
    tables?: number;
    rows?: number;
    files?: number;
    archiveBytes?: number;
    verified?: boolean;
  } | null;
};
const labels: Record<string, string> = {
  queued: "Đang chờ xử lý",
  running: "Đang xử lý",
  completed: "Hoàn tất",
  failed: "Cần kiểm tra",
  pruned: "Đã hết thời hạn giữ",
};
export default function BackupOperations() {
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [worker, setWorker] = useState(false),
    [policy, setPolicy] = useState<Policy>({
      enabled: false,
      hourVN: 2,
      retentionDays: 30,
      nextRun: "",
    }),
    [jobs, setJobs] = useState<Job[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState<"backup" | "policy" | Job | null>(null);
  async function load() {
    const data = await api.get<{ policy: Policy; jobs: Job[] }>(
      "/operations/backups",
    );
    setPolicy(data.policy);
    setJobs(data.jobs);
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const capability = await api.get<{
          enabled: boolean;
          workerConfigured: boolean;
        }>("/operations/backups/capabilities");
        if (!alive) return;
        setEnabled(capability.enabled);
        setWorker(capability.workerConfigured);
        if (capability.enabled) await load();
      } catch (error) {
        if (alive)
          setMessage(
            error instanceof Error
              ? error.message
              : "Không tải được trạng thái sao lưu.",
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thực hiện được yêu cầu.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <header className="page-header">
        <div>
          <span className="eyebrow">VẬN HÀNH HỆ THỐNG</span>
          <h1 className="page-title">Sao lưu & kiểm tra khôi phục</h1>
        </div>
        <button
          className="secondary-action"
          disabled={busy || !enabled}
          onClick={() => action(load)}
        >
          Cập nhật trạng thái
        </button>
      </header>
      {message && (
        <p role="status" className="surface-card p-4">
          {message}
        </p>
      )}
      {enabled === null ? (
        <p>Đang kiểm tra…</p>
      ) : !enabled ? (
        <p className="surface-card p-5">
          Chức năng vận hành sao lưu chưa được bật.
        </p>
      ) : (
        <>
          <section className="surface-card p-5 space-y-3">
            <h2 className="text-xl font-bold">Bảo vệ và kiểm chứng dữ liệu</h2>
            <p>
              Mỗi bản sao được mã hóa, sau đó khôi phục thử vào cơ sở dữ liệu
              tạm bằng tài khoản chỉ có quyền tại vùng thử. Hệ thống đối chiếu
              số dòng, nội dung, khóa ngoại và file minh chứng trước khi ghi
              nhận đã kiểm chứng.
            </p>
            <p>
              Kiểm tra khôi phục không thay thế dữ liệu đang sử dụng. Trang này
              không cung cấp tải file dữ liệu hoặc khóa mã hóa. Khóa cần được
              quản trị viên giữ riêng và sao lưu an toàn.
            </p>
            {!worker && (
              <p className="workflow-alert" role="status">
                Worker sao lưu chưa được bật hoặc chưa đủ cấu hình. Lịch và yêu
                cầu thực thi đang tắt; cần hoàn tất kiểm tra hạ tầng trước khi
                sử dụng.
              </p>
            )}
            <button
              className="primary-action"
              disabled={busy || !worker}
              onClick={() => setConfirm("backup")}
            >
              Tạo bản sao lưu ngay
            </button>
          </section>
          <form
            className="surface-card p-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirm("policy");
            }}
          >
            <h2 className="text-xl font-bold">Lịch sao lưu tự động</h2>
            <label className="flex gap-3">
              <input
                type="checkbox"
                checked={policy.enabled}
                disabled={!worker || busy}
                onChange={(event) =>
                  setPolicy({ ...policy, enabled: event.target.checked })
                }
              />
              Sao lưu hằng ngày và kiểm tra khôi phục mỗi bản
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                Giờ thực hiện (Việt Nam)
                <input
                  className="input-field block w-full"
                  type="number"
                  min={0}
                  max={23}
                  required
                  value={policy.hourVN}
                  onChange={(event) =>
                    setPolicy({ ...policy, hourVN: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Giữ các bản đã kiểm chứng (ngày)
                <input
                  className="input-field block w-full"
                  type="number"
                  min={7}
                  max={365}
                  required
                  value={policy.retentionDays}
                  onChange={(event) =>
                    setPolicy({
                      ...policy,
                      retentionDays: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <p>
              Luôn giữ ít nhất 3 bản đã kiểm chứng. Không tự xóa bản chưa kiểm
              chứng. Lịch chỉ chạy khi worker hoạt động.
            </p>
            {policy.nextRun && (
              <p>
                Lần kế tiếp:{" "}
                {new Date(policy.nextRun).toLocaleString("vi-VN", {
                  timeZone: "Asia/Ho_Chi_Minh",
                })}
              </p>
            )}
            <button className="primary-action" disabled={busy || !worker}>
              Lưu cấu hình lịch
            </button>
          </form>
          <section className="surface-card p-5 space-y-4">
            <h2 className="text-xl font-bold">Lịch sử sao lưu và kiểm tra</h2>
            {!jobs.length ? (
              <p>Chưa có bản sao lưu được ghi nhận.</p>
            ) : (
              jobs.map((job) => (
                <article
                  key={job.id}
                  className="rounded-xl border p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold">
                      {job.kind === "verify"
                        ? "Kiểm tra khôi phục"
                        : "Sao lưu mã hóa"}{" "}
                      · {labels[job.state] || job.state}
                    </h3>
                    {job.summary?.verified && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
                        Đã kiểm chứng
                      </span>
                    )}
                  </div>
                  <p className="break-all text-sm">Mã: {job.id}</p>
                  {job.summary && (
                    <p>
                      {job.summary.tables ?? 0} bảng · {job.summary.rows ?? 0}{" "}
                      dòng · {job.summary.files ?? 0} file minh chứng
                      {job.summary.archiveBytes
                        ? ` · ${(job.summary.archiveBytes / 1048576).toFixed(2)} MB mã hóa`
                        : ""}
                    </p>
                  )}
                  {job.errorCode && (
                    <p role="status">
                      Mã kiểm tra: {job.errorCode}. Cần quản trị hạ tầng kiểm
                      tra; hệ thống không ghi nội dung dữ liệu vào thông báo
                      lỗi.
                    </p>
                  )}
                  {job.kind === "backup" &&
                    ["completed", "failed"].includes(job.state) && (
                      <button
                        className="secondary-action"
                        disabled={busy || !worker}
                        onClick={() => setConfirm(job)}
                      >
                        Kiểm tra khôi phục lại
                      </button>
                    )}
                </article>
              ))
            )}
          </section>
        </>
      )}
      {confirm && (
        <ManagementDialog
          title={
            confirm === "policy"
              ? "Xác nhận lịch sao lưu"
              : confirm === "backup"
                ? "Tạo bản sao lưu mã hóa"
                : "Kiểm tra khôi phục bản sao"
          }
          busy={busy}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === "policy"
              ? `${policy.enabled ? "Bật" : "Tắt"} lịch hằng ngày lúc ${policy.hourVN}:00 giờ Việt Nam, giữ ${policy.retentionDays} ngày và ít nhất 3 bản đã kiểm chứng.`
              : confirm === "backup"
                ? "Tạo bản mã hóa rồi kiểm tra khôi phục tại vùng dữ liệu tạm. Tác vụ chạy nền và được theo dõi trong lịch sử."
                : "Giải mã và kiểm tra trên vùng dữ liệu riêng. Không thay cơ sở dữ liệu đang sử dụng."}
          </p>
          <button
            className="primary-action"
            disabled={busy}
            onClick={() =>
              action(async () => {
                if (confirm === "policy")
                  await api.put("/operations/backups/policy", {
                    enabled: policy.enabled,
                    hourVN: policy.hourVN,
                    retentionDays: policy.retentionDays,
                  });
                else if (confirm === "backup")
                  await api.post("/operations/backups", {});
                else
                  await api.post(
                    `/operations/backups/${confirm.id}/verify`,
                    {},
                  );
                setConfirm(null);
                await load();
                setMessage(
                  "Đã ghi nhận yêu cầu. Dùng Cập nhật trạng thái để theo dõi.",
                );
              })
            }
          >
            Xác nhận
          </button>
        </ManagementDialog>
      )}
    </div>
  );
}
