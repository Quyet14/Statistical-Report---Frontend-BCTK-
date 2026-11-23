"use client";

import { useId, useState, type ReactNode } from "react";
import { ExpandOutlined, CompressOutlined, LineChartOutlined, PieChartOutlined, BarChartOutlined } from "@ant-design/icons";
import s from "./charts.module.css";

type Tone = "blue" | "violet" | "mint" | "rose" | "amber" | "cyan";
type Point = { day: string; value: number };
type Row = { name: string; value: number };
const n = (v: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(v);
const short = (v: number) => Math.abs(v) >= 1e9 ? `${n(v / 1e9)} tỷ` : Math.abs(v) >= 1e6 ? `${n(v / 1e6)} tr` : n(v);
const day = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`;

export function ChartCard({ title, subtitle, tone = "blue", children, icon = "line" }: { title: string; subtitle: string; tone?: Tone; children: ReactNode; icon?: "line" | "ring" | "bar" }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <section className={s.card} data-tone={tone} data-expanded={expanded} aria-labelledby={id}>
    <header className={s.heading}><span className={s.icon}>{icon === "ring" ? <PieChartOutlined /> : icon === "bar" ? <BarChartOutlined /> : <LineChartOutlined />}</span><div><h3 id={id}>{title}</h3><p>{subtitle}</p></div><button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} aria-label={`${expanded ? "Thu gọn" : "Mở rộng"} biểu đồ ${title}`} title={expanded ? "Thu gọn" : "Mở rộng"}>{expanded ? <CompressOutlined /> : <ExpandOutlined />}</button></header>
    <div className={s.body}>{children}</div>
  </section>;
}

export function SeriesChart({ points, label, kind = "line" }: { points: Point[]; label: string; kind?: "line" | "column" }) {
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(1, ...points.map(p => p.value));
  const x = (i: number) => points.length === 1 ? 260 : 44 + i * 454 / Math.max(1, points.length - 1);
  const y = (v: number) => 166 - v * 134 / max;
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const point = selected == null ? null : points[selected];
  if (!points.length) return <ChartEmpty />;
  return <>
    <div className={s.readout} aria-live="off"><span>{point ? day(point.day) : "Tổng trong kỳ"}</span><strong>{n(point ? point.value : points.reduce((sum, p) => sum + p.value, 0))}<small> lượt</small></strong></div>
    <svg className={s.plot} viewBox="0 0 520 195" role="img" aria-label={label}>
      <title>{label}</title>
      {[0, .5, 1].map(ratio => <g key={ratio}><line x1="44" y1={y(max * ratio)} x2="498" y2={y(max * ratio)} className={s.gridLine} /><text x="36" y={y(max * ratio) + 4} textAnchor="end" className={s.axisText}>{short(max * ratio)}</text></g>)}
      {kind === "column" ? points.map((p, i) => <rect key={p.day} x={x(i) - Math.min(24, 300 / points.length) / 2} y={y(p.value)} width={Math.min(24, 300 / points.length)} height={Math.max(0, 166 - y(p.value))} rx={Math.min(3, 60 / points.length)} className={s.column}><title>{p.day}: {n(p.value)} lượt</title></rect>) : <><polygon points={`44,166 ${line} ${x(points.length - 1)},166`} className={s.area} /><polyline points={line} className={s.line} /></>}
      {points.map((p, i) => i % Math.max(1, Math.ceil(points.length / 36)) === 0 || i === points.length - 1 ? <circle key={p.day} cx={x(i)} cy={y(p.value)} r={selected === i ? 6 : 3} className={s.dot} tabIndex={0} role="img" aria-label={`${day(p.day)}: ${n(p.value)} lượt`} onMouseEnter={() => setSelected(i)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(i)} onBlur={() => setSelected(null)} onClick={() => setSelected(i)}><title>{p.day}: {n(p.value)}</title></circle> : null)}
      <text x="44" y="188" className={s.axisText}>{day(points[0].day)}</text><text x="498" y="188" textAnchor="end" className={s.axisText}>{day(points.at(-1)!.day)}</text>
    </svg>
    <ChartData rows={points.map(p => ({ name: p.day, value: p.value }))} unit="lượt" />
  </>;
}

function ChartEmpty({ text = "Chưa có dữ liệu biểu đồ" }: { text?: string }) {
  return <div className={s.empty}><BarChartOutlined /><span>{text}</span></div>;
}

function ChartData({ rows, unit }: { rows: Row[]; unit: string }) {
  return <details className={s.data}><summary>Xem số liệu đầy đủ <span>{rows.length} mục</span></summary><div className={s.dataScroll}><table><caption>Số liệu biểu đồ ({unit})</caption><thead><tr><th scope="col">Mục</th><th scope="col">{unit}</th></tr></thead><tbody>{rows.map((r, i) => <tr key={`${r.name}:${i}`}><th scope="row">{r.name}</th><td>{n(r.value)}</td></tr>)}</tbody></table></div></details>;
}

function Bars({ rows, unit = "lượt", limit = 5 }: { rows: Row[]; unit?: string; limit?: number }) {
  if (!rows.length) return <ChartEmpty />;
  const ordered = [...rows].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...ordered.map(r => Math.abs(r.value)));
  return <><ol className={s.bars}>{ordered.slice(0, limit).map((r, i) => <li key={`${r.name}:${i}`}><div><span title={r.name}>{r.name}</span><strong title={`${n(r.value)} ${unit}`}>{unit === "VNĐ" ? short(r.value) : n(r.value)}</strong></div><progress max={max} value={Math.abs(r.value)} aria-label={`${r.name}: ${n(r.value)} ${unit}`} /></li>)}</ol><ChartData rows={ordered} unit={unit} /></>;
}

function Ring({ value, total, caption, center }: { value: number; total: number; caption: string; center: string }) {
  const percent = total > 0 ? Math.min(100, Math.max(0, value / total * 100)) : 0;
  return <div className={s.ringWrap}><svg viewBox="0 0 180 180" role="img" aria-label={`${caption}: ${center}`}><circle cx="90" cy="90" r="70" className={s.ringTrack} /><circle cx="90" cy="90" r="70" className={s.ringValue} pathLength="100" strokeDasharray={`${percent} 100`} transform="rotate(-90 90 90)" /><text x="90" y="88" textAnchor="middle" className={s.ringNumber}>{center}</text><text x="90" y="111" textAnchor="middle" className={s.ringCaption}>{caption}</text></svg></div>;
}

type HospitalData = {
  cls?: { trend: { day: string; requested: number; performed: number; waiting: number }[] };
  metrics: { visits: number; admissions: number; discharges: number; currentInpatients: number; revenue: number | null; bedOccupancy: number | null };
  trend: { day: string; visits: number; admissions: number }[];
  departments: { name: string; discharges: number; currentInpatients: number }[];
  breakdown: { routine: number; emergency: number };
  bedSnapshot?: { active: number; occupied: number; asOf: string };
  cash?: { collected: number; refunded: number; invalid: number };
};

export function HospitalCharts({ data, period, section }: { data: HospitalData | null; period: string; section: "clinical" | "cls" }) {
  return <div className={`${s.group} ${s.embedded}`} role="group" aria-label={section === "clinical" ? "Biểu đồ hoạt động khoa/phòng" : "Biểu đồ dịch vụ CLS"}>
    <div className={section === "clinical" ? s.departmentGrid : s.serviceGrid}>
      {section === "clinical" ? <>
    <ChartCard title="Diễn biến lượt khám" subtitle={period} tone="blue">{data ? <SeriesChart points={data.trend.map(p => ({ day: p.day, value: p.visits }))} label="Biểu đồ lượt khám theo ngày" /> : <ChartEmpty />}</ChartCard>
    <ChartCard title="Nhập viện theo ngày" subtitle={period} tone="violet">{data ? <SeriesChart points={data.trend.map(p => ({ day: p.day, value: p.admissions }))} kind="column" label="Biểu đồ nhập viện theo ngày" /> : <ChartEmpty />}</ChartCard>
    <ChartCard title="Đang điều trị theo khoa" subtitle="Tại thời điểm chốt số liệu" tone="rose" icon="bar">{data ? <Bars rows={data.departments.map(d => ({ name: d.name, value: d.currentInpatients }))} unit="bệnh án" /> : <ChartEmpty />}</ChartCard>
    <ChartCard title="Xuất viện theo khoa" subtitle={`${data ? n(data.metrics.discharges) : "—"} lượt trong kỳ`} tone="mint" icon="bar">{data ? <Bars rows={data.departments.map(d => ({ name: d.name, value: d.discharges }))} /> : <ChartEmpty />}</ChartCard>
    <ChartCard title="Cơ cấu lượt khám" subtitle="Khám thường và cấp cứu" tone="violet" icon="ring">{data ? <><Ring value={data.breakdown.routine} total={data.metrics.visits} center={short(data.metrics.visits)} caption="phiếu khám" /><div className={s.keyValues}><span><i />Khám thường <b>{n(data.breakdown.routine)}</b></span><span><i />Cấp cứu <b>{n(data.breakdown.emergency)}</b></span></div><ChartData rows={[{ name: "Khám thường", value: data.breakdown.routine }, { name: "Cấp cứu", value: data.breakdown.emergency }]} unit="phiếu khám" /></> : <ChartEmpty />}</ChartCard>
    <ChartCard title="Sử dụng giường bệnh" subtitle="Trạng thái hiện tại trong HIS" tone="amber" icon="ring">{data?.bedSnapshot && data.metrics.bedOccupancy != null ? <><Ring value={data.bedSnapshot.occupied} total={data.bedSnapshot.active} center={`${n(data.metrics.bedOccupancy)}%`} caption="giường đang dùng" /><div className={s.keyValues}><span><i />Đang dùng <b>{n(data.bedSnapshot.occupied)}</b></span><span><i />Còn trống <b>{n(Math.max(0, data.bedSnapshot.active - data.bedSnapshot.occupied))}</b></span></div><p className={s.note}>{n(data.bedSnapshot.active)} giường hoạt động · {data.bedSnapshot.asOf.replace("T", " ")}</p></> : <ChartEmpty />}</ChartCard>
    <ChartCard title="Thu và hoàn trả" subtitle="VNĐ · gồm tạm ứng, đã trừ hoàn" tone="cyan" icon="bar">{data?.cash && data.metrics.revenue != null && data.cash.invalid === 0 ? <><div className={s.readout}><span>Thực thu</span><strong title={`${n(data.metrics.revenue)} VNĐ`}>{short(data.metrics.revenue)}</strong></div><Bars rows={[{ name: "Đã thu", value: data.cash.collected }, { name: "Hoàn trả", value: data.cash.refunded }, { name: "Thực thu", value: data.metrics.revenue }]} unit="VNĐ" /></> : <ChartEmpty />}</ChartCard>
      </> : <>
      <ChartCard title="Chỉ định CLS theo ngày" subtitle={period} tone="violet">{data?.cls ? <SeriesChart points={data.cls.trend.map(p => ({ day: p.day, value: p.requested }))} label="Biểu đồ chỉ định CLS theo ngày" /> : <ChartEmpty />}</ChartCard>
      <ChartCard title="CLS đã thực hiện" subtitle={period} tone="mint">{data?.cls ? <SeriesChart points={data.cls.trend.map(p => ({ day: p.day, value: p.performed }))} kind="column" label="Biểu đồ CLS đã thực hiện theo ngày" /> : <ChartEmpty />}</ChartCard>
      <ChartCard title="CLS chờ kết quả" subtitle={period} tone="amber">{data?.cls ? <SeriesChart points={data.cls.trend.map(p => ({ day: p.day, value: p.waiting }))} label="Biểu đồ CLS chờ kết quả theo ngày" /> : <ChartEmpty />}</ChartCard>
      </>}
    </div>
  </div>;
}
