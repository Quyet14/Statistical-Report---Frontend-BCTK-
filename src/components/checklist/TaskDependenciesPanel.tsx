"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Dependency = { id: number; title: string | null; completed: boolean };
type State = { items: Dependency[]; blocked: boolean; canEdit: boolean };
type Candidate = { id: number; title: string; status: string; assignee: string };

export function TaskDependenciesPanel({ taskId, revision }: { taskId: string; revision?: string }) {
  const [opened, setOpened] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [data, setData] = useState<State | null>(null);
  const [draft, setDraft] = useState<Dependency[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const sequence = useRef(0);
  const loadKey = JSON.stringify([taskId, revision]);
  const loading = opened && loadedKey !== loadKey;

  useEffect(() => {
    if (!opened) return;
    let active = true;
    void (async () => {
      try {
        const capability = await api.get<{ enabled: boolean }>("/work/dependencies/capabilities");
        if (!active) return;
        setError("");
        setEnabled(capability.enabled);
        if (capability.enabled) {
          const state = await api.get<State>(`/work/tasks/${taskId}/dependencies`);
          if (active) {
            sequence.current++;
            setData(state); setDraft(state.items); setResults([]); setTotal(0);
            setSearched(false); setSearching(false); setNotice("");
          }
        }
      } catch (reason) {
        if (active) {
          setData(null);
          setError(reason instanceof Error ? reason.message : "Không tải được phụ thuộc công việc.");
        }
      } finally { if (active) setLoadedKey(loadKey); }
    })();
    return () => { active = false; };
  }, [opened, taskId, loadKey]);

  async function find(nextPage: number) {
    const request = ++sequence.current;
    setSearching(true);
    setError("");
    try {
      const query = new URLSearchParams({ search: search.trim(), page: String(nextPage), limit: "10" });
      const response = await api.get<{items: Candidate[]; total: number}>(`/work/tasks?${query}`);
      if (request !== sequence.current) return;
      setResults(response.items);
      setSearched(true);
      setTotal(response.total);
      setPage(nextPage);
    } catch (reason) {
      if (request === sequence.current) setError(reason instanceof Error ? reason.message : "Không tìm được công việc.");
    } finally { if (request === sequence.current) setSearching(false); }
  }

  async function save() {
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const state = await api.put<State>(`/work/tasks/${taskId}/dependencies`, { dependencyIds: draft.map(item => item.id) });
      setData(state); setDraft(state.items); setNotice("Đã lưu phụ thuộc công việc.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được phụ thuộc. Vui lòng tải lại để kiểm tra trạng thái mới nhất.");
    } finally { setSaving(false); }
  }

  const dirty = !!data && draft.map(item => item.id).sort().join(",") !== data.items.map(item => item.id).sort().join(",");
  return (
    <details className="task-dependencies" onToggle={event => {
      const nextOpen = event.currentTarget.open;
      if (nextOpen) { setLoadedKey(null); setError(""); }
      setOpened(nextOpen);
    }}>
      <summary>Phụ thuộc công việc <span>{data ? `${data.items.length} liên kết` : "Việc tiên quyết"}</span></summary>
      {opened ? <div className="task-dependencies-body" aria-busy={loading || saving}>
        {loading ? <p role="status">Đang tải liên kết…</p> : null}
        {enabled === false ? <p>Chức năng này chưa được bật trên máy chủ.</p> : null}
        {error ? <p className="dependency-error" role="alert">{error}</p> : null}
        {notice ? <p role="status">{notice}</p> : null}
        {!loading && enabled && data ? <>
          <p className={data.blocked ? "dependency-waiting" : "dependency-ready"}>
            {data.blocked ? "Đang chờ việc tiên quyết hoàn tất và được duyệt." : data.items.length ? "Đã đủ điều kiện bắt đầu." : "Không có việc tiên quyết."}
          </p>
          {draft.length ? <ul aria-label="Danh sách việc tiên quyết">{draft.map(item => <li key={item.id}>
            <span aria-label={item.completed ? "Đã hoàn tất" : "Chưa hoàn tất"}>{item.completed ? "✓" : "◷"}</span>
            <span>{item.title ?? "Công việc ngoài phạm vi xem hiện tại"}</span>
            {data.canEdit ? <button type="button" disabled={saving} onClick={() => { setDraft(items => items.filter(row => row.id !== item.id)); setNotice(""); }} aria-label={`Bỏ phụ thuộc ${item.title ?? "đã ẩn"}`}>Bỏ</button> : null}
          </li>)}</ul> : null}
          {data.canEdit ? <>
            <p>Chọn tối đa 50 việc trong phạm vi quản lý. Chỉ sửa liên kết khi việc này chưa bắt đầu.</p>
            <form className="dependency-search" onSubmit={event => { event.preventDefault(); void find(1); }}>
              <input aria-label="Tìm việc tiên quyết" placeholder="Tìm tên việc hoặc người thực hiện…" value={search} maxLength={150} disabled={saving} onChange={event => {setSearch(event.target.value); setResults([]); setTotal(0); setSearched(false); sequence.current++; setSearching(false);}} />
              <button type="submit" disabled={searching || saving}>Tìm</button>
            </form>
            {searching ? <p role="status">Đang tìm…</p> : null}
            {searched && !searching && results.every(item => String(item.id) === taskId) ? <p>Không tìm thấy công việc phù hợp trong phạm vi của bạn.</p> : null}
            <ul aria-label="Kết quả tìm việc tiên quyết">{results.filter(item => String(item.id) !== taskId).map(item => <li key={item.id}>
              <span>{item.title}<small>{item.assignee}</small></span>
              <button type="button" disabled={saving || draft.length >= 50 || draft.some(row => row.id === item.id)} onClick={() => {setDraft(rows => [...rows, {id: item.id, title: item.title, completed: item.status === "done"}]);setNotice("");}}>Chọn</button>
            </li>)}</ul>
            {total > 10 ? <div className="dependency-pagination">
              <button type="button" disabled={searching || page <= 1} onClick={() => void find(page-1)}>Trước</button>
              <span>Trang {page}/{Math.ceil(total/10)}</span>
              <button type="button" disabled={searching || page*10 >= total} onClick={() => void find(page+1)}>Sau</button>
            </div> : null}
            <div className="dependency-actions">
              <button type="button" className="primary-action" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Đang lưu…" : "Lưu phụ thuộc"}</button>
              {dirty ? <button type="button" disabled={saving} onClick={() => setDraft(data.items)}>Hủy thay đổi</button> : null}
            </div>
          </> : <p>Liên kết do người quản lý thiết lập trước khi công việc bắt đầu.</p>}
        </> : null}
      </div> : null}
    </details>
  );
}
