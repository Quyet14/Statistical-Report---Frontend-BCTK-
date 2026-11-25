"use client";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as RM } from "react";
import s from "./welcome.module.css";
import { scene3d } from "./Scene3d";

export type Kind = "tasks" | "approve" | "flow" | "chart" | "org" | "cal" | "scan";
export type Item = { icon: string; title: string; text: string; tags?: string[]; kind: Kind; labels?: string[]; chip?: string };
const v = (o: Record<string, string | number>) => o as CSSProperties;
const pad = (n: number) => String(n).padStart(2, "0");
const mod = (h: string) => h.replace(/class="([^"]+)"/g, (_, c: string) => `class="${c.split(" ").map(n => s[n] ?? n).join(" ")}"`);
const DEFAULT_CAPS: Record<Kind, string[]> = { tasks: [], approve: ["Chờ duyệt", "Đã duyệt"], flow: [], chart: ["Tỷ lệ KPI 92%"], org: [], cal: ["Ca sáng", "Ca đêm"], scan: ["Kiểm định còn 45 ngày"] };

export default function Showcase({ items }: { items: Item[] }) {
  const [a, setA] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) setA(Number((e.target as HTMLElement).dataset.i)); }),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    refs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const tilt = (e: RM<HTMLDivElement>, reset = false) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--ry", reset ? "0" : String((e.clientX - r.left) / r.width - 0.5));
    e.currentTarget.style.setProperty("--rx", reset ? "0" : String((e.clientY - r.top) / r.height - 0.5));
  };
  const it = items[a];
  const caps = it.kind === "tasks" ? [] : it.labels ?? DEFAULT_CAPS[it.kind];
  return (
    <div className={s.story}>
      <div>
        {items.map((x, i) => (
          <article key={x.title} ref={el => { refs.current[i] = el; }} data-i={i} className={`${s.step} ${s["tone" + (i % 6)]} ${i === a ? s.stepOn : ""}`}>
            <div className={s.rowHead}><span className={s.ticon} aria-hidden="true">{x.icon}</span><span className={s.count}>{pad(i + 1)} / {pad(items.length)}</span></div>
            <h3>{x.title}</h3>
            <p>{x.text}</p>
            {x.tags && <div className={s.tags}>{x.tags.map(t => <span key={t}>{t}</span>)}</div>}
          </article>
        ))}
      </div>
      <div className={`${s.pin} ${s["tone" + (a % 6)]}`} aria-hidden="true" onMouseMove={tilt} onMouseLeave={e => tilt(e, true)}>
        <div className={s.glow2} />
        <i className={s.dust} />
        <div className={s.pinHead}><span>{pad(a + 1)} / {pad(items.length)}</span>{it.title}</div>
        <div className={s.dots}>{items.map((x, i) => <button key={x.title} tabIndex={-1} className={`${s.dot} ${i === a ? s.dotOn : ""}`} onClick={() => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })} />)}</div>
        <div key={a}>
          <i className={s.sweep} />
          <div className={s.w3} dangerouslySetInnerHTML={{ __html: mod(scene3d(it.kind, it.labels)) }} />
          <div className={s.caps}>{caps.map((x, k) => <span key={x} style={v({ "--i": k })}>{x}</span>)}</div>
          <div className={`${s.fl3} ${s.fl3a}`}><span className={s.ticon}>{it.icon}</span></div>
        </div>
      </div>
    </div>
  );
}