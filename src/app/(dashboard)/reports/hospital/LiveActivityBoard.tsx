"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { PauseOutlined, CaretRightOutlined, SyncOutlined } from "@ant-design/icons";
import s from "./live-board.module.css";

type Service = { name: string; requested: number; performed: number; waiting: number };
type Department = { id: number | null; name: string; visits: number; admissions: number; discharges: number; currentInpatients: number; revenue: number | null };
const n = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
function Value({ value }: { value: number | null }) { return <span key={String(value)} className={s.value}>{n(value)}</span>; }
const motionQuery = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (changed: () => void) => { const query = matchMedia(motionQuery); query.addEventListener('change', changed); return () => query.removeEventListener('change', changed); };

function Feed({ title, count, running, children, label }: { title: string; count: number; running: boolean; children: ReactNode; label: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const hovering = useRef(false);
  const focused = useRef(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const element = viewport.current;
    if (!element || !running || expanded) return;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(element);
    let frame = 0;
    let previous = 0;
    let position = element.scrollTop;
    let direction = 1;
    const tick = (time: number) => {
      const elapsed = previous ? Math.min(50, time - previous) : 0;
      previous = time;
      const limit = element.scrollHeight - element.clientHeight;
      if (visible && !document.hidden && !hovering.current && !focused.current && limit > 2) {
        // Preserve fractional pixels for smooth movement on high-refresh displays.
        if (Math.abs(element.scrollTop - position) > 2) position = element.scrollTop;
        position = Math.max(0, Math.min(limit, position + direction * elapsed * .018));
        element.scrollTop = position;
        if (position >= limit) direction = -1;
        else if (position <= 0) direction = 1;
      } else position = element.scrollTop;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [running, expanded]);
  return <section className={s.feed} aria-label={label}>
    <header className={s.feedHeading}><h3>{title}</h3><span>{count} mục</span><button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>{expanded ? "Thu gọn" : "Xem tất cả"}</button></header>
    <div ref={viewport} className={s.viewport} data-expanded={expanded} tabIndex={0} aria-label={`Danh sách ${title}`} onPointerEnter={() => { hovering.current = true; }} onPointerLeave={() => { hovering.current = false; }} onFocusCapture={() => { focused.current = true; }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) focused.current = false; }}>{children}</div>
  </section>;
}

export default function LiveActivityBoard({ groups, departments, updatedAt, updating, stale, departmentCharts, serviceCharts }: { departmentCharts: ReactNode; serviceCharts: ReactNode; groups: Service[]; departments: Department[]; updatedAt?: string; updating: boolean; stale: boolean }) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => matchMedia(motionQuery).matches, () => true);
  const [runOverride, setRunOverride] = useState<boolean | null>(null);
  const running = runOverride ?? !reducedMotion;
  return <section className={s.board} aria-labelledby="activity-board-heading">
    <header className={s.heading}><div><h2 id="activity-board-heading">Dịch vụ & khoa/phòng</h2></div><div className={s.controls}><span className={s.status} data-stale={stale}><i />{stale ? "Đang hiển thị bản trước" : updating ? "Đang cập nhật" : updatedAt ? `Cập nhật ${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(updatedAt))}` : "Chưa có dữ liệu"}</span><button type="button" aria-label={running ? "Dừng chạy" : "Chạy danh sách"} aria-pressed={running} onClick={() => setRunOverride(!running)}>{running ? <PauseOutlined /> : <CaretRightOutlined />}{running ? "Dừng chạy" : "Chạy danh sách"}</button><span className={s.interval}><SyncOutlined /> Tự cập nhật</span></div></header>
    <div className={s.mosaic}>
    <div className={s.departmentRow}>
      <div className={s.departmentFeed}>
      <Feed title="Hoạt động theo khoa/phòng" count={departments.length} running={running} label="Theo dõi hoạt động khoa/phòng">
        {departments.length ? <table className={s.table}><caption className={s.srOnly}>Hoạt động theo khoa/phòng, tự cập nhật khi có số liệu mới</caption><thead><tr>{['Khoa/phòng', 'Lượt khám', 'Nhập viện', 'Xuất viện', 'Đang điều trị', 'Thực thu (nơi lập)'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{departments.map(row => <tr key={row.id ?? 'unknown'}><th scope="row">{row.name}</th><td><Value value={row.visits} /></td><td><Value value={row.admissions} /></td><td><Value value={row.discharges} /></td><td><Value value={row.currentInpatients} /></td><td><Value value={row.revenue} /></td></tr>)}</tbody></table> : <p className={s.empty}>Chưa có dữ liệu khoa/phòng</p>}
      </Feed>
      </div>
      <div className={s.departmentCharts}>{departmentCharts}</div>
    </div>
    <div className={s.serviceRow}>
      <div className={s.serviceCharts}>{serviceCharts}</div>
      <div className={s.serviceFeed}>
      <Feed title="Nhóm dịch vụ CLS" count={groups.length} running={running} label="Theo dõi nhóm dịch vụ CLS">
        {groups.length ? <ul className={s.services} aria-label="Số lượt chỉ định theo nhóm dịch vụ">{groups.map(group => <li key={group.name}><div className={s.serviceTitle}><strong>{group.name}</strong><span>Chỉ định <Value value={group.requested} /></span></div><div className={s.serviceNumbers}><span data-tone="mint">Đã thực hiện <Value value={group.performed} /></span><span data-tone="amber">Chờ kết quả <Value value={group.waiting} /></span></div></li>)}</ul> : <p className={s.empty}>Chưa có dữ liệu nhóm dịch vụ</p>}
      </Feed>
      </div>
    </div>
    </div>
  </section>;
}
