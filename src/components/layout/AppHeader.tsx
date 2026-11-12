"use client";
import { WorkspaceGalaxy } from "./GalaxyBackdrop";
import { noticeLink } from "@/lib/notice-link";
import { GlobalSearch } from "./GlobalSearch";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { clearTokens, getStoredUser } from "@/lib/auth";
import { useFeedback } from "@/context/FeedbackContext";
import { api } from "@/lib/api";
import { useTasks } from "@/context/TaskContext";
import { BellOutlined, PlusOutlined } from "@ant-design/icons";
import { WorkspaceSculpture } from "@/components/common/WorkspaceSculpture";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { useLocale } from "@/i18n/locale-provider";

const defaultForm = {
  title: "",
  titleEn: "",
  assignee: "",
  assigneeId: 0,
  time: "",
  status: "todo" as const,
  priority: "Medium" as const,
  progress: 0,
  checklistText: "",
  checklistTextEn: "",
  reviewerId: undefined as number | undefined,
};

type UserOption = { id: number; name: string; email?: string; role?: string; departmentId?: number | null };
type NotificationItem = {
  id: number;
  taskId: number;
  title: string;
  message: string;
  type: "upcoming" | "overdue" | "mention" | "handoff" | "approval";
  href?: string;
  readAt?: string | null;
  createdAt: string;
};
type DisplayNotification = {
  id: string;
  title: string;
  message: string;
  type: "upcoming" | "overdue" | "assignment" | "done" | "mention" | "handoff" | "approval";
  href?: string;
  readAt?: string | null;
  createdAt: string;
  apiId?: number;
};

const getLocalDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export function AppHeader() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { notify } = useFeedback();
  const router = useRouter();
  const headerRef = useRef<HTMLElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    // Dashboard pages scroll inside this panel, rather than the browser window.
    const scrollPanel = headerRef.current?.closest<HTMLElement>(".dashboard-main");
    if (!scrollPanel) return;
    const updateHeader = () => setIsCompact(scrollPanel.scrollTop > 24);
    updateHeader();
    scrollPanel.addEventListener("scroll", updateHeader, { passive: true });
    return () => scrollPanel.removeEventListener("scroll", updateHeader);
  }, []);
  const { tasks, addTask } = useTasks();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(() => getStoredUser());
  useEffect(() => {
    const user = getStoredUser();
    if (user?.id) {
      void api.get<{ name: string }>(`/users/${user.id}`).then((profile) => setCurrentUser((current) => current ? { ...current, name: profile.name } : current)).catch(() => undefined);
    }
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [reviewers, setReviewers] = useState<UserOption[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const displayNotifications = useMemo<DisplayNotification[]>(() => {
    const apiNotifications = notifications.map((item) => ({
      id: `api-${item.id}`,
      title: item.title,
      message: item.message,
      type: item.type,
      readAt: item.readAt,
      createdAt: item.createdAt,
      apiId: item.id,
      href: item.href,
    }));
    if (apiNotifications.length > 0) return apiNotifications;

    const today = getLocalDate();
    const soon = getLocalDate(addDays(new Date(), 2));
    const upcoming = tasks
      .filter((task) => {
        const date = (task.dueDate ?? task.time).slice(0, 10);
        return task.status !== "done" && date >= today && date <= soon;
      })
      .slice(0, 4)
      .map<DisplayNotification>((task) => ({
        id: `upcoming-${task.id}`,
        title: `${task.title} sắp hết hạn`,
        message: `${task.assignee} · ${task.departmentName ?? task.department ?? "Chưa có phòng ban"} · hạn ${(task.dueDate ?? task.time).slice(0, 10).split("-").reverse().join("/")}`,
        type: "upcoming",
        createdAt: task.time,
      }));
    const assignments = tasks
      .filter((task) => task.status !== "done")
      .slice(0, 3)
      .map<DisplayNotification>((task) => ({
        id: `assignment-${task.id}`,
        title: "Sếp giao bạn task mới",
        message: `${task.title} · ${task.priority} · ${task.assignee}`,
        type: "assignment",
        createdAt: task.time,
      }));
    const done = tasks
      .filter((task) => task.status === "done")
      .slice(0, 3)
      .map<DisplayNotification>((task) => ({
        id: `done-${task.id}`,
        title: `${task.title} vừa được duyệt hoàn thành`,
        message: `${task.departmentName ?? task.department ?? "Chưa có phòng ban"} · tiến độ 100%`,
        type: "done",
        createdAt: task.time,
      }));

    return [...upcoming, ...assignments, ...done].slice(0, 8);
  }, [notifications, tasks]);
  const unreadNotificationCount = displayNotifications.filter((item) => !item.readAt).length;
  useEffect(() => {
    if (!currentUser?.id) return;

    const loadNotifications = async () => {
      try {
        const items = await api.get<NotificationItem[]>('/notifications');
        setNotifications(items);
      } catch {
        setNotifications([]);
      }
    };

    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 15 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || !["admin","manager","leader"].includes(currentUser.role)) return;
    void api.get<{ assignees: UserOption[]; reviewers: UserOption[] }>("/work/lookups")
      .then((items) => { setUsers(items.assignees); setReviewers(items.reviewers); })
      .catch(() => setUsers([]));
  }, [currentUser]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "progress" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCreatingTask || !form.title.trim()) {
      return;
    }

    setIsCreatingTask(true);
    const checklistLines = form.checklistText.split("\n");
    const checklistLinesEn = form.checklistTextEn.split("\n");
    const checklistTitles = checklistLines
      .map((item) => item.trim())
      .filter(Boolean);
    const checklistTitlesEn = checklistLines
      .map((item, index) =>
        item.trim() ? checklistLinesEn[index]?.trim() ?? "" : null,
      )
      .filter((item): item is string => item !== null);
    const saved = await addTask({
      ...form,
      checklistTitles,
      checklistTitlesEn,
    });
    setIsCreatingTask(false);
    if (!saved) return;
    setForm(defaultForm);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    try { await clearTokens(); window.location.replace("/login"); }
    catch { notify({ kind: "error", title: t("header.logoutError"), description: t("header.retryConnection") }); }
  };

  return (
    <>
      <header ref={headerRef} className={`workspace-masthead${isCompact ? " is-compact" : ""}${pathname === "/checklist" ? "" : " masthead-toolbar-only"}`} aria-label={t("header.workspace")}>
      <div className="topbar">
        <div className="topbar-title-group">
          <p className="topbar-title">BỆNH VIỆN HỮU NGHỊ</p>
          <span className="topbar-subtitle">VietNam-HuuNghi Hospital</span>
        </div>

        <div className="topbar-actions">
          <LocaleSwitcher />
          <GlobalSearch />

          {currentUser && ["admin","manager","leader"].includes(currentUser.role) ? (
            <button className="primary-action" type="button" onClick={() => setIsOpen(true)}>
              <PlusOutlined aria-hidden="true" /> {t("header.assign")}
            </button>
          ) : null}

          <div className="notification-wrap">
            <button
              className="icon-button"
              type="button"
              aria-label={t("header.notifications")}
              aria-expanded={isNotificationsOpen}
              onClick={() => setIsNotificationsOpen((current) => !current)}
            >
              <BellOutlined aria-hidden="true" /> {unreadNotificationCount ? <span className="notif-dot">{unreadNotificationCount}</span> : null}
            </button>

            {isNotificationsOpen ? (
              <div className="notification-panel" role="menu" aria-label={t("header.notificationPanel")}>
                <div className="notification-panel-header">
                  <strong>{t("header.operationsNotifications")}</strong>
                  <span>{displayNotifications.length} {t("header.updates")}</span>
                </div>
                {displayNotifications.length ? displayNotifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`notification-item notification-${item.type}${item.readAt ? " is-read" : ""}`}
                    onClick={() => {
                      if (item.apiId && !item.readAt) {
                        void api.patch(`/notifications/${item.apiId}/read`, {}).then(() => {
                          setNotifications((current) => current.map((notification) => notification.id === item.apiId
                            ? { ...notification, readAt: new Date().toISOString() }
                            : notification));
                        });
                      }
                      router.push(noticeLink(item.href));
                      setIsNotificationsOpen(false);
                    }}
                  >
                    <strong data-i18n-skip>{item.title}</strong>
                    <span data-i18n-skip>{item.message}</span>
                  </button>
                )) : <div className="notification-empty">{t("header.emptyNotifications")}</div>}
              </div>
            ) : null}
          </div>

          <div className="user-menu-wrap">
            <button
              type="button"
              className="user-chip"
              aria-expanded={isUserMenuOpen}
              onClick={() => setIsUserMenuOpen((current) => !current)}
            >
              <span className="user-badge">{currentUser?.name?.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() ?? "U"}</span>
              <span data-i18n-skip>{currentUser?.name ?? "Người dùng"}</span>
            </button>

            {isUserMenuOpen ? (
              <div className="user-menu-panel" role="menu">
                <button type="button" role="menuitem" onClick={() => { setIsUserMenuOpen(false); router.push("/account"); }}>
                  {t("header.account")}
                </button>
                <button type="button" role="menuitem" onClick={handleLogout}>
                  {t("header.logout")}
                </button>
              </div>
            ) : null}
          </div>

        </div>
      </div>
      </header>
      {pathname === "/checklist" ? <div className="workspace-banner">
        <section className="workspace-hero" aria-labelledby="workspace-welcome">
          <div className="workspace-hero-copy">
            <h2 id="workspace-welcome"><span>{t("header.welcome")}</span><em>{t("header.welcomeSub")}</em></h2>
          </div>
          <div className="masthead-art"><WorkspaceGalaxy /><WorkspaceSculpture /></div>
        </section>
      </div> : null}

      {isOpen ? (
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-assignment-title" onClick={(event) => event.stopPropagation()}>
            <div className="task-modal-header">
              <h3 id="task-assignment-title">{t("task.new")}</h3>
              <button type="button" className="close-button" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="task-form">
              <div className="task-form-fields">
              <label>
                {t("task.title")}
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder={t("task.titlePlaceholder")}
                  required
                />
              </label>

              <div className="task-form-row">
                <label>
                  {t("task.assignee")}
                  <select
                    name="assigneeId"
                    value={form.assigneeId || ""}
                    onChange={(event) => {
                      const user = users.find((item) => item.id === Number(event.target.value));
                      setForm((current) => ({ ...current, assigneeId: Number(event.target.value), assignee: user?.name ?? "", reviewerId: undefined }));
                    }}
                    required
                  >
                    <option value="">{t("task.chooseUser")}</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </label>

                <label>
                  {t("task.time")}
                  <input
                    name="time"
                    type="date"
                    value={form.time}
                    onChange={handleChange}
                    required
                  />
                </label>
              </div>

              <label>{t("task.reviewer")}<select value={form.reviewerId ?? ""} onChange={event => setForm(current => ({ ...current, reviewerId: Number(event.target.value) || undefined }))}><option value="">{t("task.noReview")}</option>{reviewers.filter(person => person.id !== form.assigneeId && (person.role === "admin" || (person.departmentId != null && person.departmentId === users.find(item => item.id === form.assigneeId)?.departmentId))).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select><small>{t("task.reviewHelp")}</small></label>
              <div className="task-form-row">
                <label>
                  {t("task.status")}
                  <select name="status" value={form.status} onChange={handleChange} disabled>
                    <option value="todo">{t("task.todo")}</option>
                    <option value="doing">{t("task.doing")}</option>
                    <option value="done">{t("task.done")}</option>
                  </select>
                </label>

                <label>
                  {t("task.priority")}
                  <select name="priority" value={form.priority} onChange={handleChange}>
                    <option value="Low">{t("task.low")}</option>
                    <option value="Medium">{t("task.medium")}</option>
                    <option value="High">{t("task.high")}</option>
                  </select>
                </label>
              </div>

              <label>
                {t("task.progress")}
                <input
                  name="progress"
                  disabled
                  type="range"
                  min="0"
                  max="100"
                  value={form.progress}
                  onChange={handleChange}
                />
                <span className="progress-value">{form.progress}%</span>
              </label>

              <label>
                {t("task.checklist")}
                <textarea
                  name="checklistText"
                  value={form.checklistText}
                  onChange={handleChange}
                  placeholder={t("task.checklistPlaceholder")}
                  rows={4}
                />
              </label>

              </div>
              <div className="task-modal-actions">
                <button type="button" className="secondary-action" onClick={() => setIsOpen(false)}>
                  {t("task.cancel")}
                </button>
                <button type="submit" className="primary-action" disabled={isCreatingTask}>
                  {isCreatingTask ? t("task.saving") : t("header.assign")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
