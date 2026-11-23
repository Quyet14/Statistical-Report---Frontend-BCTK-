"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import s from "./welcome.module.css";

export type Kind = "tasks" | "approve" | "flow" | "chart" | "org" | "cal" | "scan";
export type Item = { icon: string; title: string; text: string; tags?: string[]; kind: Kind; labels?: string[]; chip?: string };
const v = (o: Record<string, string | number>) => o as CSSProperties;

function Scene({ kind, labels = [], chip = "Hôm nay" }: Pick<Item, "kind" | "labels" | "chip">) {
  switch (kind) {
    case "tasks":
      return <div><div className={s.sbar}><i /></div>{labels.map((l, i) => <div key={l} className={s.trow} style={v({ "--i": i })}><b /><span>{l}</span><em>{chip}</em></div>)}</div>;
    case "approve":
      return <div><div className={s.acard}><small>Đề nghị mua vật tư y tế</small><strong>Khoa Hồi sức</strong><div className={s.badges}><span className={s.pend}>Chờ phê duyệt</span><span className={s.done}>Đã phê duyệt</span></div><div className={s.avs}><i /><i /><i /></div></div><div className={s.toast}>Đã gửi thông báo đến người liên quan</div></div>;
    case "flow":
      return <div><div className={s.fl}><div className={s.fline} /><em className={s.fpk} />{labels.map((l, i) => <div key={l} className={s.fnode} style={v({ "--i": i })}><span>{i + 1}</span><b>{l}</b></div>)}</div><div className={s.fstat}><small>Tiến độ xử lý</small><div className={s.sbar}><i /></div></div></div>;
    case "chart":
      return <div><div className={s.kpi}><small>Tỷ lệ hoàn thành KPI</small><strong>92%</strong></div><div className={s.cbars}>{[38, 55, 46, 70, 62, 85, 100].map((h, i) => <i key={i} style={v({ "--h": `${h}%`, "--i": i })} />)}</div></div>;
    case "org":
      return <div className={s.og}><svg className={s.oline} viewBox="0 0 400 240" preserveAspectRatio="none"><path d="M200 70V110M67 110H333M67 110V150M200 110V150M333 110V150" /></svg><div className={`${s.onode} ${s.otop}`}>{labels[0]}</div><div className={s.orow}>{labels.slice(1).map((l, i) => <div key={l} className={s.onode} style={v({ "--i": i })}>{l}</div>)}</div></div>;
    case "cal":
      return <div><div className={s.cal}>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(d => <b key={d}>{d}</b>)}{Array.from({ length: 28 }, (_, i) => <i key={i} className={[1, 4, 9, 12, 16, 19, 23, 26].includes(i) ? s.on : [2, 7, 14, 21].includes(i) ? s.on2 : ""} style={v({ "--i": i })} />)}</div><div className={s.lg}><span><i />Ca sáng</span><span><i />Ca đêm</span></div></div>;
    default:
      return <div className={s.sc}><div className={s.qr}>{Array.from({ length: 25 }, (_, i) => <i key={i} />)}<em /></div><div className={s.res}><small>Máy thở, Khoa Hồi sức</small><strong>Kiểm định còn 45 ngày</strong><span>Đã quét mã QR</span></div></div>;
  }
}

function Row({ it, i }: { it: Item; i: number }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <article ref={ref} className={`${s.row} ${s["tone" + (i % 6)]} ${i % 2 ? s.rowAlt : ""} ${on ? s.rowOn : ""}`}>
      <div className={s.rowText}>
        <span className={s.ticon} aria-hidden="true">{it.icon}</span>
        <h3>{it.title}</h3>
        <p>{it.text}</p>
        {it.tags && <div className={s.tags}>{it.tags.map(x => <span key={x}>{x}</span>)}</div>}
      </div>
      <div className={s.panel} aria-hidden="true">
        <div className={s.glow2} />
        {on && <div className={s.frame}><div className={s.fbar}><i /><i /><i /><span>{it.title}</span></div><div className={s.fbody}><Scene kind={it.kind} labels={it.labels} chip={it.chip} /></div></div>}
      </div>
    </article>
  );
}

export default function Showcase({ items }: { items: Item[] }) {
  return <div className={s.rows}>{items.map((it, i) => <Row key={it.title} it={it} i={i} />)}</div>;
}