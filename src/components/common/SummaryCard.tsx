import type { ReactNode } from "react";

export function SummaryCard({ label, value, tone, icon }: {
  label: string;
  value: ReactNode;
  tone: "blue" | "green" | "red" | "amber" | "violet";
  icon: ReactNode;
}) {
  return (
    <div className={`stat-card metric-card ${tone}`}>
      <span className="stat-icon" aria-hidden="true">{icon}</span>
      <span className="stat-label">{label}</span>
      <div className="stat-value">{value}</div>
    </div>
  );
}
