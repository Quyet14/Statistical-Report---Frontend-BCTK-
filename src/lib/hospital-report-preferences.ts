export type HospitalReportFilters = { period: string; date: string };

export function validHospitalReportFilters(value: unknown): value is HospitalReportFilters {
  if (!value || typeof value !== "object") return false;
  const { period, date } = value as HospitalReportFilters;
  if (!["day", "month", "year"].includes(period) || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && parsed.getUTCFullYear() >= 2000 && parsed.getUTCFullYear() <= 2100;
}

export function readHospitalReportFilters(storage: Pick<Storage, "getItem">, key: string, fallback: HospitalReportFilters): HospitalReportFilters {
  try {
    const saved: unknown = JSON.parse(storage.getItem(key) ?? "null");
    return validHospitalReportFilters(saved) ? { period: saved.period, date: saved.date } : fallback;
  } catch { return fallback; }
}

export function saveHospitalReportFilters(storage: Pick<Storage, "setItem">, key: string, filters: HospitalReportFilters) {
  if (!validHospitalReportFilters(filters)) return;
  try { storage.setItem(key, JSON.stringify(filters)); } catch { /* Filters still work when browser storage is unavailable. */ }
}
