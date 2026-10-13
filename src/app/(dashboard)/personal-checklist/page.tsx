"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getStoredUser } from "@/lib/auth";

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
    const stored = window.localStorage.getItem(getStorageKey());
    if (stored) {
      try {
        const parsedItems = JSON.parse(stored) as PersonalItem[];
        window.setTimeout(() => setItems(parsedItems), 0);
      } catch {
        window.localStorage.removeItem(getStorageKey());
      }
    }
    window.setTimeout(() => setStorageReady(true), 0);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(getStorageKey(), JSON.stringify(items));
    window.dispatchEvent(new Event("personal-checklist-updated"));
  }, [items, storageReady]);

  const visibleItems = useMemo(
    () => items.filter((item) => filter === "all" || (filter === "done" ? item.completed : !item.completed)),
    [filter, items],
  );
  const completedCount = items.filter((item) => item.completed).length;
  const progress = items.length ? Math.round((completedCount / items.length) * 100) : 0;
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
    setItems((current) => [{ id: crypto.randomUUID(), title: cleanTitle, note: note.trim(), plannedDate, completed: false, createdAt: new Date().toISOString() }, ...current]);
    setTitle("");
    setNote("");
  };

  const deleteItem = (id: string) => setItems((current) => current.filter((item) => item.id !== id));

  const saveEdit = (id: string) => {
    const cleanTitle = editingTitle.trim();
    if (!cleanTitle) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, title: cleanTitle } : item));
    setEditingId(null);
    setEditingTitle("");
  };

  return (
    <div className="personal-page">
      <div className="page-header personal-header">
        <div>
          <span className="eyebrow">Không gian riêng tư</span>
          <h3 className="page-title">Công việc cá nhân</h3>
          <p className="personal-subtitle">Lập danh sách việc riêng. Dữ liệu chỉ được lưu trên thiết bị và tài khoản của bạn.</p>
        </div>
        <div className="personal-progress-badge"><strong>{progress}%</strong><span>hoàn thành</span></div>
      </div>

      <div className="personal-layout">
        <section className="panel-card personal-create-card">
          <div className="section-header"><h4>Thêm công việc riêng</h4><span>Không chia sẻ</span></div>
          <form className="personal-form" onSubmit={addItem}>
            <label>Việc cần làm<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Chuẩn bị tài liệu họp" /></label>
            <label>Ngày thực hiện<input type="date" value={plannedDate} onChange={(event) => { setPlannedDate(event.target.value); setSelectedDate(event.target.value); }} /></label>
            <label>Ghi chú <span className="optional-label">(không bắt buộc)</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thêm ghi chú cho công việc..." rows={4} /></label>
            <button type="submit" className="primary-action">＋ Thêm vào checklist</button>
          </form>
        </section>

        <section className="panel-card personal-list-card">
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
                return <button key={date} type="button" className={`calendar-day ${selectedDate === date ? "selected" : ""} ${getLocalDate() === date ? "today" : ""}`} onClick={() => setSelectedDate(date)}><span>{day}</span>{count ? <small>{count}</small> : null}</button>;
              })}
            </div>
          </div>
          <div className="personal-work-panel">
          <div className="personal-list-header">
            <div><h4>Công việc ngày {selectedDate.split("-").reverse().join("/")}</h4><span>{selectedItems.length} việc trong ngày · {completedCount}/{items.length} việc đã hoàn thành</span></div>
            <div className="toggle-group personal-filters">
              {(["all", "open", "done"] as Filter[]).map((value) => <button key={value} type="button" className={filter === value ? "toggle-btn active" : "toggle-btn"} onClick={() => setFilter(value)}>{value === "all" ? "Tất cả" : value === "open" ? "Đang làm" : "Đã xong"}</button>)}
            </div>
          </div>
          <div className="personal-progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="personal-items">
            {selectedItems.length ? selectedItems.map((item) => (
              <article key={item.id} className={`personal-item ${item.completed ? "completed" : ""}`}>
                <input type="checkbox" checked={item.completed} onChange={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed } : entry))} aria-label={`Đánh dấu ${item.title}`} />
                <div className="personal-item-content">
                  {editingId === item.id ? <input className="personal-edit-input" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveEdit(item.id); }} autoFocus /> : <strong>{item.title}</strong>}
                  {item.note ? <p>{item.note}</p> : null}
                </div>
                <div className="personal-item-actions">
                  {editingId === item.id ? <button type="button" className="mini-action edit" onClick={() => saveEdit(item.id)}>Lưu</button> : <button type="button" className="mini-action edit" onClick={() => { setEditingId(item.id); setEditingTitle(item.title); }}>Sửa</button>}
                  <button type="button" className="mini-action delete" onClick={() => deleteItem(item.id)}>Xóa</button>
                </div>
              </article>
            )) : <div className="personal-empty"><strong>{items.length ? "Không có việc trong bộ lọc này" : "Checklist của bạn đang trống"}</strong><span>Thêm một việc riêng để bắt đầu theo dõi tiến độ.</span></div>}
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}
