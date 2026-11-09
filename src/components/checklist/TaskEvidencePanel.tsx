"use client";

import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { api } from "@/lib/api";

type Evidence = {
  id: number;
  taskId: number;
  uploaderId: number;
  originalName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  canDelete: boolean;
};

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function TaskEvidencePanel({
  taskId,
  canUpload,
}: {
  taskId: string;
  canUpload: boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [files, setFiles] = useState<Evidence[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<Evidence | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const refresh = async () => {
    try {
      const capabilities = await api.get<{ enabled: boolean }>(
        "/tasks/evidence/capabilities",
      );
      setEnabled(capabilities.enabled);
      if (!capabilities.enabled) {
        setLoaded(true);
        return;
      }
      setFiles(await api.get<Evidence[]>(`/tasks/${taskId}/attachments`));
      setLoaded(true);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được minh chứng.");
    }
  };

  const toggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpened = event.currentTarget.open;
    setOpened(nextOpened);
    if (nextOpened && !loaded) void refresh();
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File tối đa 5 MB.");
      event.target.value = "";
      return;
    }
    setBusy("upload");
    setUploadProgress(0);
    setError("");
    const body = new FormData();
    body.append("file", file);
    try {
      await api.postFormWithProgress<Evidence>(
        `/tasks/${taskId}/attachments`,
        body,
        (loaded, total) => {
          setUploadProgress(total ? Math.min(99, Math.round((loaded / total) * 100)) : null);
        },
      );
      setUploadProgress(100);
      await refresh();
      event.target.value = "";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải lên được file.");
    } finally {
      setBusy(null);
      setUploadProgress(null);
      event.target.value = "";
    }
  };

  const openPreview = (file: Evidence) => {
    setPreview(file);
    setPreviewError(false);
    setPreviewLoading(true);
  };

  const remove = async (id: number) => {
    if (busy) return;
    setBusy("remove");
    setError("");
    try {
      await api.del(`/tasks/${taskId}/attachments/${id}`);
      setFiles((current) => current.filter((file) => file.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không xóa được file.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <details className="task-evidence" onToggle={toggle}>
      <summary>Minh chứng ({loaded ? files.length : "…" })</summary>
      {opened ? (
        <div className="task-evidence-content">
          <p>Chỉ tải ảnh JPEG/PNG hoặc PDF tối đa 5 MB. Không tải thông tin người bệnh.</p>
          {error ? <p className="task-evidence-error" role="alert">{error}</p> : null}
          {enabled === false ? (
            <p>Chức năng chưa được bật trên hệ thống.</p>
          ) : null}
          {enabled === null && !loaded ? <p>Đang tải minh chứng…</p> : null}
          {busy === "upload" && uploadProgress !== null ? (
            <div className="task-evidence-upload-progress" role="status">
              <span>Đang tải lên: {uploadProgress}%</span>
              <progress max={100} value={uploadProgress} aria-label="Tiến trình tải minh chứng" />
            </div>
          ) : busy === "upload" ? (
            <p role="status">Đang tải lên minh chứng…</p>
          ) : busy === "remove" ? (
            <p role="status">Đang xóa minh chứng…</p>
          ) : null}
          {files.map((file) => (
            <div className="task-evidence-row" key={file.id}>
              <span className="task-evidence-name">{file.originalName}</span>
              <span>{formatBytes(file.byteSize)}</span>
              {["image/jpeg", "image/png", "application/pdf"].includes(file.mimeType) ? (
                <button type="button" disabled={!!busy} onClick={() => openPreview(file)}>
                  Xem trước
                </button>
              ) : null}
              <a href={`/api/tasks/${taskId}/attachments/${file.id}/file`} download>
                Tải xuống
              </a>
              {file.canDelete ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void remove(file.id)}
                >
                  Xóa
                </button>
              ) : null}
            </div>
          ))}
          {canUpload && enabled ? (
            <label className="task-evidence-upload">
              {busy === "upload" ? "Đang tải lên…" : "Thêm minh chứng"}
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                disabled={!!busy}
                onChange={(event) => void upload(event)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
      {preview ? (
        <div
          className="task-evidence-preview-backdrop"
          onClick={() => setPreview(null)}
        >
          <section
            className="task-evidence-preview"
            role="dialog"
            aria-modal="true"
            aria-label={`Xem trước ${preview.originalName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="task-evidence-preview-header">
              <strong>{preview.originalName}</strong>
              <button type="button" onClick={() => setPreview(null)}>
                Đóng
              </button>
            </div>
            {previewLoading ? <p role="status">Đang tải bản xem trước…</p> : null}
            {previewError ? (
              <p className="task-evidence-error" role="alert">
                Không mở được bản xem trước. Hãy tải file xuống để kiểm tra.
              </p>
            ) : (
              <iframe
                title={`Xem trước ${preview.originalName}`}
                sandbox="allow-same-origin"
                src={`/api/tasks/${taskId}/attachments/${preview.id}/file?preview=true`}
                onLoad={() => setPreviewLoading(false)}
                onError={() => {
                  setPreviewLoading(false);
                  setPreviewError(true);
                }}
              />
            )}
          </section>
        </div>
      ) : null}
    </details>
  );
}
