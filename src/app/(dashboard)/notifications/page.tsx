"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { noticeLink } from "@/lib/notice-link";
import { NotificationPreferencesCard } from "@/components/layout/NotificationPreferencesCard";
import { api } from "@/lib/api";
import { useFeedback } from "@/context/FeedbackContext";
type Notice = {
  id: number;
  taskId: number;
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
  type: string;
  href?: string;
};
export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const { runAction } = useFeedback();
  useEffect(() => {
    let cancelled = false;
    void api
      .get<Notice[]>("/notifications")
      .then((value) => {
        if (!cancelled) setItems(value);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được thông báo.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Theo dõi & nhắc việc</span>
          <h3 className="page-title">Trung tâm thông báo</h3>
          <p className="page-description">
            {items.filter((item) => !item.readAt).length} chưa đọc · Các nhắc
            việc gần nhất trong phạm vi tài khoản của bạn.
          </p>
        </div>
        <label className="soft-select">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(event) => setOnlyUnread(event.target.checked)}
          />{" "}
          Chỉ chưa đọc
        </label>
      </div>
      <NotificationPreferencesCard />
      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p role="status">Đang tải thông báo…</p> : null}
      <div className="notification-center-list">
        {items
          .filter((item) => !onlyUnread || !item.readAt)
          .map((item) => (
            <article
              className={`panel-card notification-center-item ${item.readAt ? "is-read" : ""}`}
              key={item.id}
            >
              <span className={`notification-center-dot ${item.type}`} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <time>{new Date(item.createdAt).toLocaleString("vi-VN")}</time>
                <div className="workflow-inline-actions">
                  <Link className="secondary-action" href={noticeLink(item.href)}>
                    Mở bảng công việc
                  </Link>
                  {!item.readAt ? (
                    <button
                      className="secondary-action"
                      onClick={async () => {
                        const result = await runAction(
                          () =>
                            api.patch<Notice>(
                              `/notifications/${item.id}/read`,
                              {},
                            ),
                          { title: "Đã đánh dấu thông báo đã đọc" },
                        );
                        if (result.ok)
                          setItems((current) =>
                            current.map((notice) =>
                              notice.id === item.id
                                ? {
                                    ...notice,
                                    readAt:
                                      result.value.readAt ??
                                      new Date().toISOString(),
                                  }
                                : notice,
                            ),
                          );
                      }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  ) : (
                    <span>Đã đọc</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        {!loading && !items.some((item) => !onlyUnread || !item.readAt) ? (
          <div className="panel-card workflow-empty">
            Bạn đã xem hết các thông báo.
          </div>
        ) : null}
      </div>
    </div>
  );
}
