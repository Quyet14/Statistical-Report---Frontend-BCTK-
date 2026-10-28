"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getStoredUser } from "@/lib/auth";
import { SummaryCard } from "@/components/common/SummaryCard";
import { useFeedback } from "@/context/FeedbackContext";
import { CheckCircleOutlined, ClockCircleOutlined, UnorderedListOutlined, CalendarOutlined, LockOutlined, PlusOutlined, DownOutlined } from "@ant-design/icons";

type PersonalItem = {
  id: string;
  title: string;
  note: string;
  completed: boolean;
  createdAt: string;
  plannedDate?: string;
};

type Filter = "all" | "open" | "done";

const getStorageKey = () => `personal-checklist-${getStoredUser()?.id ?? "guest"}`;
const getLocalDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const getItemDate = (item: PersonalItem) => item.plannedDate ?? item.createdAt.slice(0, 10);
const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const weekDays = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export default function PersonalChecklistPage() {
  const { notify } = useFeedback();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PersonalItem[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [plannedDate, setPlannedDate] = useState(getLocalDate);
  const [selectedDate, setSelectedDate] = useState(getLocalDate);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let restored: PersonalItem[] = [];
    try {
      const stored = window.localStorage.getItem(getStorageKey());
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) restored = parsed as PersonalItem[];
    } catch {
      notify({ kind: "error", title: "Không đọc được dữ liệu cá nhân", description: "Kiểm tra quyền lưu trữ của trình duyệt rồi tải lại trang." });
    }
    const timer = window.setTimeout(() => { setItems(restored); setStorageReady(true); }, 0);
    return () => window.clearTimeout(timer);
  }, [notify]);

  const commitItems = (nextItems: PersonalItem[]) => {
    if (!storageReady) return false;
    try {
      window.localStorage.setItem(getStorageKey(), JSON.stringify(nextItems));
      setItems(nextItems);
      window.dispatchEvent(new Event("personal-checklist-updated"));
      return true;
    } catch {
      notify({ kind: "error", title: "Chưa lưu được công việc", description: "Bộ nhớ trình duyệt không khả dụng hoặc đã đầy. Nội dung bạn nhập vẫn được giữ lại." });
      return false;
    }
  };

  const visibleItems = useMemo(
    () => items.filter((item) => filter === "all" || (filter === "done" ? item.completed : !item.completed)),
    [filter, items],
  );
  const dayItems = items.filter((item) => getItemDate(item) === selectedDate);
  const completedCount = dayItems.filter((item) => item.completed).length;
  const progress = dayItems.length ? Math.round((completedCount / dayItems.length) * 100) : 0;
  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const firstDayOffset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: firstDayOffset + daysInMonth }, (_, index) => index < firstDayOffset ? null : index - firstDayOffset + 1);
  const selectedItems = visibleItems.filter((item) => getItemDate(item) === selectedDate);
  const itemCountByDate = items.reduce<Record<string, number>>((counts, item) => {
    const date = getItemDate(item);
    counts[date] = (counts[date] ?? 0) + 1;
    return counts;
  }, {});

  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!commitItems([{ id, title: cleanTitle, note: note.trim(), plannedDate, completed: false, createdAt: new Date().toISOString() }, ...items])) return;
    notify({ title: "Đã thêm công việc cá nhân", description: cleanTitle });
    setTitle("");
    setNote("");
    setSelectedDate(plannedDate);
    setFilter("all");
  };

  const deleteItem = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (commitItems(items.filter((entry) => entry.id !== id))) notify({ title: "Đã xóa công việc", description: item?.title, kind: "info" });
  };

  const toggleItem = (item: PersonalItem) => {
    const completed = !item.completed;
    if (!commitItems(items.map((entry) => entry.id === item.id ? { ...entry, completed } : entry))) return;
    notify({ title: completed ? "Hoàn thành công việc!" : "Đã mở lại công việc", description: item.title, presentation: completed ? "completion" : "dialog" });
  };

  const saveEdit = (id: string) => {
    const cleanTitle = editingTitle.trim();
    if (!cleanTitle) return;
    if (!commitItems(items.map((item) => item.id === id ? { ...item, title: cleanTitle } : item))) return;
    notify({ title: "Đã lưu thay đổi", description: cleanTitle });
    setEditingId(null);
    setEditingTitle("");
  };

  return (
    <div className="dashboard-page personal-page" data-page="personal">
      <div className="page-header personal-header">
        <div>
          <span className="eyebrow">Không gian riêng tư</span>
          <h3 className="page-title">Công việc cá nhân</h3>
          <p className="personal-subtitle">Lập danh sách việc riêng. Dữ liệu chỉ được lưu trên thiết bị và tài khoản của bạn.</p>
        </div>
        <button type="button" className="secondary-action" onClick={() => { setSelectedDate(getLocalDate()); setPlannedDate(getLocalDate()); setCalendarDate(new Date()); }}><CalendarOutlined aria-hidden="true" /> Hôm nay</button>
      </div>

      <div className="stats-grid">
        <SummaryCard label="Việc trong ngày" value={dayItems.length} tone="violet" icon={<UnorderedListOutlined />} />
        <SummaryCard label="Chưa hoàn thành" value={dayItems.length - completedCount} tone="blue" icon={<ClockCircleOutlined />} />
        <SummaryCard label="Đã hoàn thành" value={completedCount} tone="green" icon={<CheckCircleOutlined />} />
      </div>
      <div className="personal-layout">
        <aside className="personal-tools">
        <section className="panel-card personal-calendar-card" aria-label="Lịch công việc cá nhân">
          <div className="personal-calendar-caption"><CalendarOutlined aria-hidden="true" /><span>Lịch công việc</span></div>
          <div className="personal-calendar">
            <div className="personal-calendar-header">
              <button type="button" className="calendar-nav" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} aria-label="Tháng trước">‹</button>
              <strong>{monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}</strong>
              <button type="button" className="calendar-nav" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} aria-label="Tháng sau">›</button>
            </div>
            <div className="personal-calendar-grid personal-calendar-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="personal-calendar-grid">
              {calendarDays.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} className="calendar-day empty" />;
                const date = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const count = itemCountByDate[date] ?? 0;
                return <button key={date} type="button" className={`calendar-day ${selectedDate === date ? "selected" : ""} ${getLocalDate() === date ? "today" : ""}`} aria-pressed={selectedDate === date} aria-label={`${date.split("-").reverse().join("/")}, ${count} công việc`} onClick={() => { setSelectedDate(date); setPlannedDate(date); }}><span>{day}</span>{count ? <small>{count}</small> : null}</button>;
              })}
            </div>
          </div>
          <div className="personal-calendar-legend"><span><i /> Có công việc</span><span><LockOutlined aria-hidden="true" /> Lưu trên thiết bị</span></div>
        </section>
        <div className="personal-day-overview">
          <span>KẾ HOẠCH NGÀY ĐÃ CHỌN</span>
          <strong>{dayItems.length ? `${completedCount}/${dayItems.length} việc hoàn thành` : "Một ngày, một khởi đầu mới"}</strong>
          <p>{dayItems.length ? "Chia nhỏ công việc để dễ tập trung và theo dõi tiến độ." : "Chọn ngày trên lịch và thêm điều bạn muốn hoàn thành."}</p>
        </div>
        </aside>

        <div className="personal-main">
        <section className="panel-card personal-create-card">
          <div className="section-header"><h4><PlusOutlined aria-hidden="true" /> Thêm công việc</h4><span><LockOutlined aria-hidden="true" /> Chỉ mình bạn</span></div>
          <form className="personal-form personal-quick-form" onSubmit={addItem}>
            <label className="personal-title-field">Việc cần làm<input ref={titleInputRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Bạn muốn hoàn thành việc gì?" required /></label>
            <label className="personal-date-field">Ngày thực hiện<input type="date" value={plannedDate} required onChange={(event) => {
              const value = event.target.value;
              setPlannedDate(value);
              if (value) { setSelectedDate(value); setCalendarDate(new Date(`${value}T12:00:00`)); }
            }} /></label>
            <button type="submit" className="primary-action personal-add-action" disabled={!storageReady}><PlusOutlined aria-hidden="true" /> Thêm việc</button>
            <details className="personal-note">
              <summary><span>{note ? "Ghi chú đã thêm" : "Thêm ghi chú (tùy chọn)"}</span><DownOutlined aria-hidden="true" /></summary>
              <label className="sr-only" htmlFor="personal-note">Ghi chú công việc</label>
              <textarea id="personal-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thêm thông tin cần nhớ..." rows={2} />
            </details>
          </form>
        </section>
        <section className="panel-card personal-list-card">
          <div className="personal-work-panel">
          <div className="personal-list-header">
            <div><h4>Ngày {selectedDate.split("-").reverse().join("/")}</h4><span>{dayItems.length ? `${selectedItems.length} công việc hiển thị · ${progress}% hoàn thành` : "Sẵn sàng cho kế hoạch mới"}</span></div>
            <div className="toggle-group personal-filters">
              {(["all", "open", "done"] as Filter[]).map((value) => <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? "toggle-btn active" : "toggle-btn"} onClick={() => setFilter(value)}>{value === "all" ? "Tất cả" : value === "open" ? "Chưa xong" : "Đã xong"}</button>)}
            </div>
          </div>
          {dayItems.length ? <div className="personal-progress-track" role="progressbar" aria-label="Tiến độ công việc trong ngày" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div> : null}
          <div className="personal-items">
            {selectedItems.length ? selectedItems.map((item) => (
              <article key={item.id} className={`personal-item ${item.completed ? "completed" : ""}`}>
                <input type="checkbox" checked={item.completed} onChange={() => toggleItem(item)} aria-label={`Đánh dấu ${item.title}`} />
                <div className="personal-item-content">
                  {editingId === item.id ? <input className="personal-edit-input" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveEdit(item.id); if (event.key === "Escape") setEditingId(null); }} autoFocus aria-label="Sửa tên công việc" /> : <strong>{item.title}</strong>}
                  {item.note ? <p>{item.note}</p> : null}
                </div>
                <div className="personal-item-actions">
                  {editingId === item.id ? <><button type="button" className="mini-action edit" onClick={() => saveEdit(item.id)}>Lưu</button><button type="button" className="mini-action" onClick={() => setEditingId(null)}>Hủy</button></> : <button type="button" className="mini-action edit" onClick={() => { setEditingId(item.id); setEditingTitle(item.title); }}>Sửa</button>}
                  <button type="button" className="mini-action delete" onClick={() => deleteItem(item.id)}>Xóa</button>
                </div>
              </article>
            )) : <div className="personal-empty">
              <div className="personal-empty-icon" aria-hidden="true">{dayItems.length ? <CheckCircleOutlined /> : <UnorderedListOutlined />}</div>
              <strong>{dayItems.length ? "Không có công việc trong bộ lọc này" : "Ngày này chưa có công việc"}</strong>
              <span>{dayItems.length ? "Chọn Tất cả để xem các công việc đã lên kế hoạch." : "Thêm công việc đầu tiên và bắt đầu một ngày có kế hoạch."}</span>
              <button type="button" className="personal-empty-action" onClick={() => { if (dayItems.length) setFilter("all"); else titleInputRef.current?.focus(); }}>{dayItems.length ? "Xem tất cả công việc" : "Thêm công việc đầu tiên"}</button>
            </div>}
          </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
