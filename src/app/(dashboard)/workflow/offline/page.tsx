"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { createVault, discard, metadata } from "@/lib/offline-vault";
type Task = {
  id: number;
  title: string;
  assigneeId: number;
  isParticipant?: boolean;
  status: string;
  locked?: boolean;
};
type Meta = { ownerId: number; expiresAt: number; pendingCount: number };
export default function OfflineSetup() {
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [tasks, setTasks] = useState<Task[]>([]),
    [selected, setSelected] = useState<number[]>([]);
  const [phrase, setPhrase] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [personal, setPersonal] = useState(false),
    [replace, setReplace] = useState(false);
  const [existing, setExisting] = useState<Meta | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const cap = await api.get<{ enabled: boolean }>(
          "/work/offline/capabilities",
        );
        if (!alive) return;
        setEnabled(cap.enabled);
        const saved = await metadata();
        if (!alive) return;
        setExisting(saved);
        if (cap.enabled) {
          const user = getStoredUser(),
            all = await api.get<Task[]>("/tasks");
          if (alive)
            setTasks(
              all.filter(
                (task) =>
                  task.status !== "done" &&
                  !task.locked &&
                  (task.assigneeId === user?.id || task.isParticipant),
              ),
            );
        }
      } catch (error) {
        if (alive)
          setMessage(
            error instanceof Error ? error.message : "Không tải được dữ liệu.",
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  async function prepare(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !personal || !selected.length || selected.length > 50) return;
    if (existing && !replace) {
      setMessage(
        "Vui lòng xác nhận thay thế bản cũ. Các dấu chọn chưa đồng bộ sẽ mất.",
      );
      return;
    }
    if (phrase !== confirmation) {
      setMessage("Hai mật khẩu ngoại tuyến chưa khớp.");
      return;
    }
    setBusy(true);
    try {
      const snapshot = await api.post<Parameters<typeof createVault>[0]>(
        "/work/offline/snapshot",
        { taskIds: selected },
      );
      await createVault(snapshot, phrase);
      setExisting(await metadata());
      setPhrase("");
      setConfirmation("");
      setReplace(false);
      setMessage(
        "Đã mã hóa và lưu. Mở màn hình ngoại tuyến để sử dụng; mật khẩu này không được gửi lên máy chủ.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không tạo được bản ngoại tuyến.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 offline-setup-page">
      <header className="page-header">
        <div>
          <span className="section-eyebrow">THIẾT BỊ CÁ NHÂN</span>
          <h1 className="page-title">Công việc ngoại tuyến</h1>
          <p className="page-subtitle">
            Chủ động lưu tối đa 50 việc, mã hóa riêng và sử dụng trong 24 giờ.
          </p>
        </div>
        <div className="toolbar">
          <Link className="secondary-action" href="/workflow">Về công việc</Link>
          <a className="primary-action" href="/offline.html">Mở bản lưu</a>
        </div>
      </header>
      <details className="surface-card p-5 space-y-4 workspace-help">
        <summary>Cách sử dụng ngoại tuyến</summary>
        <p>
          Chỉ lưu các việc bạn trực tiếp thực hiện hoặc phối hợp. Ngoại tuyến hỗ
          trợ dấu chọn checklist; nhập số, ký xác nhận, bình luận và duyệt cần
          có mạng. Khi đồng bộ, hệ thống kiểm tra lại quyền và thay đổi trên máy
          chủ. Thời gian hoàn thành được tính khi máy chủ nhận thành công.
        </p>
        <p>
          Mật khẩu ngoại tuyến riêng từ 12 ký tự chỉ dùng trên thiết bị này. Nếu
          quên, bạn cần xóa bản lưu và tạo lại; các thay đổi chưa đồng bộ sẽ
          mất. Đăng xuất chủ động sẽ xóa bản lưu.
        </p>
      </details>
      {message && (
        <p className="surface-card p-4" role="status">
          {message}
        </p>
      )}
      {existing && (
        <section className="surface-card p-5 space-y-3">
          <h2 className="font-bold">Đã có bản lưu trên trình duyệt này</h2>
          <p>
            {existing.pendingCount} thay đổi chưa đồng bộ · Hết hạn{" "}
            {new Date(existing.expiresAt).toLocaleString("vi-VN")}
          </p>
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={replace}
              onChange={(event) => setReplace(event.target.checked)}
            />
            Tôi đồng ý thay thế hoặc xóa bản này và bỏ các thay đổi chưa đồng
            bộ.
          </label>
          <button
            className="secondary-action"
            disabled={busy || !replace}
            onClick={async () => {
              setBusy(true);
              try {
                await discard();
                setExisting(null);
                setReplace(false);
                setMessage("Đã xóa bản ngoại tuyến.");
              } catch {
                setMessage("Không xóa được bản lưu. Hãy thử lại.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Xóa bản lưu
          </button>
        </section>
      )}
      {enabled === false ? (
        <p className="surface-card p-5">
          Chức năng chưa được quản trị viên bật trên máy chủ.
        </p>
      ) : enabled === null ? (
        <p>Đang kiểm tra khả năng sử dụng…</p>
      ) : (
        <form onSubmit={prepare} className="surface-card p-5 space-y-4">
          <h2 className="text-xl font-bold">Thiết lập bản lưu</h2>
          <label className="flex gap-3">
            <input
              type="checkbox"
              required
              checked={personal}
              onChange={(event) => setPersonal(event.target.checked)}
            />
            Đây là thiết bị cá nhân của tôi, có khóa màn hình. Tôi đồng ý lưu
            bản công việc mã hóa trong tối đa 24 giờ.
          </label>
          <fieldset disabled={busy} className="space-y-3">
            <legend className="font-bold">
              Chọn công việc ({selected.length}/50)
            </legend>
            {!tasks.length && <p>Không có công việc phù hợp để lưu.</p>}
            {tasks.map((task) => (
              <label key={task.id} className="flex gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={selected.includes(task.id)}
                  disabled={
                    !selected.includes(task.id) && selected.length >= 50
                  }
                  onChange={(event) =>
                    setSelected((previous) =>
                      event.target.checked
                        ? [...previous, task.id]
                        : previous.filter((id) => id !== task.id),
                    )
                  }
                />
                {task.title}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span>Mật khẩu ngoại tuyến (khác mật khẩu đăng nhập)</span>
              <input
                className="input-field w-full"
                placeholder="Tự đặt mật khẩu, ít nhất 12 ký tự"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
              />
            </label>
            <label className="space-y-2">
              <span>Nhập lại mật khẩu ngoại tuyến</span>
              <input
                className="input-field w-full"
                placeholder="Nhập lại mật khẩu vừa đặt"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          </div>
          <button
            className="primary-action"
            disabled={
              busy || !personal || !selected.length || (!!existing && !replace)
            }
          >
            {busy ? "Đang mã hóa…" : "Mã hóa và lưu trên thiết bị"}
          </button>
        </form>
      )}
    </div>
  );
}
