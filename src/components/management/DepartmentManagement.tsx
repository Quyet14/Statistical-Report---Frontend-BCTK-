"use client";

import Link from "next/link";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ApartmentOutlined, TeamOutlined, UserAddOutlined, SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { useFeedback } from "@/context/FeedbackContext";
import { SummaryCard } from "@/components/common/SummaryCard";
import { ManagementDialog } from "./ManagementDialog";

type Department = { id: number; name: string; branchId?: number | null };
type Staff = { id: number; name: string; role: string; departmentId?: number | null };

export function DepartmentManagement() {
  const { runAction } = useFeedback();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Department | "new" | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: "", branchId: "" });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [units, people] = await Promise.all([api.get<Department[]>("/departments"), api.get<Staff[]>("/users")]);
      setDepartments(units); setStaff(people); setError("");
    } catch { setDepartments([]); setStaff([]); setError("Không thể tải danh sách khoa/phòng. Vui lòng thử lại."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = departments.filter((department) => department.name.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const departmentIds = new Set(departments.map((department) => Number(department.id)));
  const assigned = staff.filter((person) => person.departmentId != null && departmentIds.has(Number(person.departmentId))).length;
  const openEdit = (department: Department | "new") => {
    setEditing(department);
    setForm(department === "new" ? { name: "", branchId: "" } : { name: department.name, branchId: department.branchId?.toString() ?? "" });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !editing || !form.name.trim()) return;
    setBusy(true);
    const payload = { name: form.name.trim(), branchId: form.branchId ? Number(form.branchId) : null };
    const result = await runAction(() => editing === "new" ? api.post("/departments", payload) : api.patch(`/departments/${editing.id}`, payload), { title: editing === "new" ? "Đã tạo khoa/phòng" : "Đã cập nhật khoa/phòng", description: payload.name });
    setBusy(false);
    if (result.ok) { setEditing(null); await load(); }
  };
  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    const result = await runAction(() => api.del(`/departments/${deleting.id}`), { title: "Đã xóa khoa/phòng", description: deleting.name, kind: "info" });
    setBusy(false);
    if (result.ok) { setDeleting(null); await load(); }
  };
  return <div className="dashboard-page management-page" data-page="settings">
    <div className="page-header"><div><h1 className="page-title">Quản lý khoa/phòng</h1><p className="page-description">Tổ chức khoa/phòng và theo dõi phân bổ nhân sự trong bệnh viện.</p></div><button type="button" className="primary-action" onClick={() => openEdit("new")}><PlusOutlined aria-hidden="true" /> Thêm khoa/phòng</button></div>
    <div className="stats-grid"><SummaryCard label="Khoa/phòng" value={departments.length} tone="violet" icon={<ApartmentOutlined />} /><SummaryCard label="Đã phân khoa" value={assigned} tone="green" icon={<TeamOutlined />} /><SummaryCard label="Chưa phân khoa" value={staff.length - assigned} tone="amber" icon={<UserAddOutlined />} /></div>
    <section className="panel-card management-directory" aria-label="Danh sách khoa phòng">
      <div className="management-toolbar"><div><h2>Danh sách khoa/phòng</h2><span>{visible.length}/{departments.length} khoa/phòng</span></div><label className="management-search"><SearchOutlined aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên khoa/phòng..." aria-label="Tìm kiếm khoa phòng" /></label></div>
      {error ? <div className="auth-alert auth-alert-error" role="alert">{error} <button type="button" className="filter-reset" onClick={() => void load()}>Thử lại</button></div> : null}
      <div className="table-scroll"><table className="modern-table management-table"><thead><tr><th>Khoa/phòng</th><th>Nhân sự</th><th>Trưởng khoa</th><th>Chi nhánh</th><th>Thao tác</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={5} className="empty-table-state">Đang tải danh sách...</td></tr> : visible.length ? visible.map((department) => {
          const members = staff.filter((person) => person.departmentId != null && Number(person.departmentId) === Number(department.id));
          const heads = members.filter((person) => person.role === "manager");
          return <tr key={department.id}><td><Link className="staff-cell record-link" href={`/departments/${department.id}`}><span className="staff-avatar" aria-hidden="true"><ApartmentOutlined /></span><strong>{department.name}</strong></Link></td><td><Link className="management-count record-link" href={`/departments/${department.id}`}>{members.length} nhân sự</Link></td><td>{heads.length ? heads.map((head, index) => <span key={head.id}>{index > 0 ? ", " : ""}<Link className="record-link" href={`/employees/${head.id}`}>{head.name}</Link></span>) : <span className="management-muted">Chưa phân công</span>}</td><td>{department.branchId ?? "—"}</td><td><div className="table-actions"><Link className="mini-action" href={`/departments/${department.id}`}>Chi tiết</Link><button type="button" className="mini-action edit" disabled={busy} onClick={() => openEdit(department)}><EditOutlined aria-hidden="true" /> Sửa</button><button type="button" className="mini-action delete" disabled={busy} onClick={() => setDeleting(department)}><DeleteOutlined aria-hidden="true" /> Xóa</button></div></td></tr>;
        }) : <tr><td colSpan={5} className="empty-table-state">{query ? "Không tìm thấy khoa/phòng phù hợp." : "Chưa có khoa/phòng. Thêm khoa/phòng để bắt đầu phân bổ nhân sự."}</td></tr>}
      </tbody></table></div>
    </section>
    {editing ? <ManagementDialog title={editing === "new" ? "Thêm khoa/phòng" : "Chỉnh sửa khoa/phòng"} busy={busy} onClose={() => setEditing(null)}><form className="management-form" onSubmit={save}>
      <label>Tên khoa/phòng<input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Khoa Nội tổng hợp" /></label>
      <label>Mã chi nhánh (không bắt buộc)<input type="number" min="1" step="1" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })} /></label>
      <div className="management-dialog-actions"><button type="button" className="secondary-action" disabled={busy} onClick={() => setEditing(null)}>Hủy</button><button type="submit" className="primary-action" disabled={busy}>{busy ? "Đang lưu..." : "Lưu khoa/phòng"}</button></div>
    </form></ManagementDialog> : null}
    {deleting ? <ManagementDialog title="Xóa khoa/phòng?" busy={busy} onClose={() => setDeleting(null)}><p className="management-delete-copy">Bạn muốn xóa khoa/phòng <strong>{deleting.name}</strong>?</p><div className="management-dialog-actions"><button type="button" className="secondary-action" disabled={busy} onClick={() => setDeleting(null)}>Hủy</button><button type="button" className="danger-action" disabled={busy} onClick={() => void remove()}>{busy ? "Đang xóa..." : "Xóa khoa/phòng"}</button></div></ManagementDialog> : null}
  </div>;
}
