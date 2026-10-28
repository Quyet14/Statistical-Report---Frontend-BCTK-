"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { clearTokens, getStoredUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { useTasks } from "@/context/TaskContext";
import { BellOutlined, SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { WorkspaceSculpture } from "@/components/common/WorkspaceSculpture";

const defaultForm = {
  title: "",
  assignee: "",
  assigneeId: 0,
  time: "",
  status: "todo" as const,
  priority: "Medium" as const,
  progress: 0,
  checklistText: "",
};

type UserOption = { id: number; name: string; email: string; role?: string };
type NotificationItem = {
  id: number;
  taskId: number;
  title: string;
  message: string;
  type: "upcoming" | "overdue";
  readAt?: string | null;
  createdAt: string;
};
type DisplayNotification = {
  id: string;
  title: string;
  message: string;
  type: "upcoming" | "overdue" | "assignment" | "done";
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchResults = normalizedSearch
    ? tasks.filter((task) => [task.title, task.assignee, task.departmentName, task.department].some((value) => value?.toLowerCase().includes(normalizedSearch))).slice(0, 6)
    : [];
  const displayNotifications = useMemo<DisplayNotification[]>(() => {
    const apiNotifications = notifications.map((item) => ({
      id: `api-${item.id}`,
      title: item.title,
      message: item.message,
      type: item.type,
      readAt: item.readAt,
      createdAt: item.createdAt,
      apiId: item.id,
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
    if (currentUser?.role !== "admin" && currentUser?.role !== "manager") return;
    void api.get<UserOption[]>("/users")
      .then((items) => setUsers(items.filter((user) => user.role?.toLowerCase() !== "admin")))
      .catch(() => setUsers([]));
  }, [currentUser]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "progress" ? Number(value) : value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim()) {
      return;
    }

    addTask({
      ...form,
      checklistTitles: form.checklistText.split("\n").map((item) => item.trim()).filter(Boolean),
    });
    setForm(defaultForm);
    setIsOpen(false);
  };

  const handleLogout = () => {
    clearTokens();
    router.replace("/login");
  };

  return (
    <>
      <header ref={headerRef} className={`workspace-masthead${isCompact ? " is-compact" : ""}`} aria-label="Không gian làm việc Bệnh viện Hữu Nghị">
      <div className="topbar">
        <div className="topbar-title-group">
          <p className="topbar-title">BỆNH VIỆN HỮU NGHỊ</p>
          <span className="topbar-subtitle">VietNam-HuuNghi Hospital</span>
        </div>

        <div className="topbar-actions">
          <div className="search-box">
            <SearchOutlined className="search-icon" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm việc, nhân sự, khoa/phòng..."
              aria-label="Tìm công việc, nhân sự, khoa phòng"
            />
            {normalizedSearch ? (
              <div className="search-results" role="listbox" aria-label="Kết quả tìm kiếm">
                {searchResults.length ? searchResults.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="search-result"
                    onClick={() => { setSearchQuery(""); router.push("/tasks"); }}
                  >
                    <strong>{task.title}</strong>
                    <span>{task.assignee} · {task.departmentName ?? task.department ?? "Chưa có phòng ban"}</span>
                  </button>
                )) : <div className="search-empty">Không tìm thấy task phù hợp</div>}
              </div>
            ) : null}
          </div>

          {currentUser?.role === "admin" || currentUser?.role === "manager" ? (
            <button className="primary-action" type="button" onClick={() => setIsOpen(true)}>
              <PlusOutlined aria-hidden="true" /> Giao việc
            </button>
          ) : null}

          <div className="notification-wrap">
            <button
              className="icon-button"
              type="button"
              aria-label="Thông báo"
              aria-expanded={isNotificationsOpen}
              onClick={() => setIsNotificationsOpen((current) => !current)}
            >
              <BellOutlined aria-hidden="true" /> {unreadNotificationCount ? <span className="notif-dot">{unreadNotificationCount}</span> : null}
            </button>

            {isNotificationsOpen ? (
              <div className="notification-panel" role="menu" aria-label="Bảng thông báo">
                <div className="notification-panel-header">
                  <strong>Thông báo vận hành</strong>
                  <span>{displayNotifications.length} cập nhật</span>
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
                      router.push("/tasks");
                      setIsNotificationsOpen(false);
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                  </button>
                )) : <div className="notification-empty">Chưa có cập nhật mới về nhiệm vụ</div>}
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
              <span>{currentUser?.name ?? "Người dùng"}</span>
            </button>

            {isUserMenuOpen ? (
              <div className="user-menu-panel" role="menu">
                <button type="button" role="menuitem" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </div>
            ) : null}
          </div>

        </div>
      </div>
      </header>
      <div className="workspace-banner">
        <section className="workspace-hero" aria-labelledby="workspace-welcome">
          <div className="workspace-hero-copy">
            <span className="hero-kicker"><span /> KHÔNG GIAN LÀM VIỆC · HUUNGHI CAREOPS</span>
            <h2 id="workspace-welcome">Một ngày hiệu quả.<br /><em>Cùng nhau tạo khác biệt.</em></h2>
            <p>Sắp xếp công việc rõ ràng, kết nối đội ngũ và dành trọn tâm huyết cho những điều quan trọng.</p>
          </div>
          <div className="masthead-art"><WorkspaceSculpture /></div>
        </section>
      </div>

      {isOpen ? (
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="task-modal" onClick={(event) => event.stopPropagation()}>
            <div className="task-modal-header">
              <h3>Giao việc mới</h3>
              <button type="button" className="close-button" onClick={() => setIsOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="task-form">
              <label>
                Nội dung công việc
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Nhập nội dung công việc"
                  required
                />
              </label>

              <div className="task-form-row">
                <label>
                  Người phụ trách
                  <select
                    name="assigneeId"
                    value={form.assigneeId || ""}
                    onChange={(event) => {
                      const user = users.find((item) => item.id === Number(event.target.value));
                      setForm((current) => ({ ...current, assigneeId: Number(event.target.value), assignee: user?.name ?? "" }));
                    }}
                    required
                  >
                    <option value="">Chọn người dùng</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </label>

                <label>
                  Thời gian
                  <input
                    name="time"
                    type="date"
                    value={form.time}
                    onChange={handleChange}
                    required
                  />
                </label>
              </div>

              <div className="task-form-row">
                <label>
                  Trạng thái
                  <select name="status" value={form.status} onChange={handleChange}>
                    <option value="todo">Chưa bắt đầu</option>
                    <option value="doing">Đang làm</option>
                    <option value="done">Hoàn thành</option>
                  </select>
                </label>

                <label>
                  Mức độ ưu tiên
                  <select name="priority" value={form.priority} onChange={handleChange}>
                    <option value="Low">Thấp</option>
                    <option value="Medium">Trung bình</option>
                    <option value="High">Cao</option>
                  </select>
                </label>
              </div>

              <label>
                Tiến độ
                <input
                  name="progress"
                  type="range"
                  min="0"
                  max="100"
                  value={form.progress}
                  onChange={handleChange}
                />
                <span className="progress-value">{form.progress}%</span>
              </label>

              <label>
                Checklist công việc
                <textarea
                  name="checklistText"
                  value={form.checklistText}
                  onChange={handleChange}
                  placeholder={"Mỗi dòng là một công việc\nVí dụ: Kiểm tra tài liệu\nGửi báo cáo cho trưởng phòng"}
                  rows={4}
                />
                <span className="form-hint">Mỗi dòng sẽ trở thành một mục để người nhận tích hoàn thành.</span>
              </label>

              <div className="task-modal-actions">
                <button type="button" className="secondary-action" onClick={() => setIsOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="primary-action">
                  Giao việc
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
