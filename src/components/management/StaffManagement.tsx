"use client";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { TeamOutlined, UserSwitchOutlined, StopOutlined, SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useFeedback } from "@/context/FeedbackContext";
import { SummaryCard } from "@/components/common/SummaryCard";
import { PasswordField } from "@/components/common/PasswordField";
import { ManagementDialog } from "./ManagementDialog";

type Staff = { id: number; name: string; email: string; role: string; departmentId?: number | null; isActive: boolean };
type Department = { id: number; name: string };
const roleNames: Record<string, string> = { admin: "Quản trị viên", manager: "Trưởng khoa", staff: "Nhân viên" };
const emptyForm = { name: "", email: "", password: "", role: "staff", departmentId: "" };

export function StaffManagement() {
  const [currentUser] = useState(getStoredUser);
  const isAdmin = currentUser?.role === "admin";
  const { runAction } = useFeedback();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [editing, setEditing] = useState<Staff | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [people, units] = await Promise.all([api.get<Staff[]>("/users/managed"), api.get<Department[]>("/departments")]);
      setStaff(isAdmin ? people : people.filter((person) => person.role === "staff" && currentUser?.departmentId != null && person.departmentId != null && Number(person.departmentId) === Number(currentUser.departmentId)));
      setDepartments(units);
      setError("");
    } catch {
      setStaff([]);
      setError("Không thể tải danh sách nhân viên. Vui lòng thử lại.");
    } finally { setLoading(false); }
  }, [isAdmin, currentUser?.departmentId]);
  useEffect(() => { void load(); }, [load]);
  const departmentNames = useMemo(() => new Map(departments.map((department) => [Number(department.id), department.name])), [departments]);
  const scope = isAdmin ? "Toàn bệnh viện" : departmentNames.get(Number(currentUser?.departmentId)) ?? "Chưa được gán khoa/phòng";
  const visible = staff.filter((person) => {
    const matchesQuery = [person.name, person.email].some((text) => text.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
    return matchesQuery && (status === "all" || Boolean(person.isActive) === (status === "active")) && (!isAdmin || departmentFilter === "all" || Number(person.departmentId) === Number(departmentFilter));
  });
  const openEdit = (person: Staff | "new") => {
    setEditing(person);
    setForm(person === "new" ? emptyForm : { name: person.name, email: person.email, password: "", role: person.role, departmentId: person.departmentId?.toString() ?? "" });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !editing || !form.name.trim()) return;
    setBusy(true);
    const payload = isAdmin
      ? { name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role, departmentId: form.departmentId ? Number(form.departmentId) : null, ...(form.password ? { password: form.password } : {}) }
      : { name: form.name.trim(), email: form.email.trim().toLowerCase() };
    const result = await runAction(() => editing === "new" ? api.post("/users", payload) : api.patch(`/users/${editing.id}`, payload), {
      title: editing === "new" ? "Đã tạo tài khoản nhân viên" : "Đã cập nhật nhân viên", description: form.name.trim(),
    });
    setBusy(false);
    if (result.ok) { setEditing(null); await load(); }
  };
  const toggleStatus = async (person: Staff) => {
    if (busy) return;
    setBusy(true);
    const result = await runAction(() => api.patch(`/users/${person.id}`, { isActive: !person.isActive }), {
      title: person.isActive ? "Đã vô hiệu hóa tài khoản" : "Đã kích hoạt tài khoản", description: person.name,
    });
    setBusy(false);
    if (result.ok) await load();
  };
  const remove = async () => {
    if (!deleting || busy || !isAdmin) return;
    setBusy(true);
    const result = await runAction(() => api.del(`/users/${deleting.id}`), { title: "Đã xóa tài khoản", description: deleting.name, kind: "info" });
    setBusy(false);
    if (result.ok) { setDeleting(null); await load(); }
  };

  return <div className="dashboard-page management-page" data-page="settings">
    <div className="page-header"><div><h1 className="page-title">Quản lý nhân viên</h1><p className="page-description">{isAdmin ? "Quản lý tài khoản, phân quyền và phân công khoa/phòng trong toàn bệnh viện." : "Cập nhật thông tin và trạng thái tài khoản nhân viên thuộc khoa/phòng của bạn."}</p></div>
      {isAdmin ? <button type="button" className="primary-action" onClick={() => openEdit("new")}><PlusOutlined aria-hidden="true" /> Thêm nhân viên</button> : currentUser?.departmentId != null ? <Link className="status-badge success record-link" href={`/departments/${currentUser.departmentId}`}>{scope} →</Link> : <span className="status-badge success">{scope}</span>}
    </div>
    <div className="stats-grid"><SummaryCard label="Tổng nhân viên" value={staff.length} tone="blue" icon={<TeamOutlined />} /><SummaryCard label="Đang hoạt động" value={staff.filter((person) => person.isActive).length} tone="green" icon={<UserSwitchOutlined />} /><SummaryCard label="Đã vô hiệu hóa" value={staff.filter((person) => !person.isActive).length} tone="amber" icon={<StopOutlined />} /></div>
    <section className="panel-card management-directory" aria-label="Danh sách nhân viên">
      <div className="management-toolbar"><div><h2>Danh sách nhân viên</h2><span>{scope} · {visible.length}/{staff.length} tài khoản</span></div><div className="management-filters">
        <label className="management-search"><SearchOutlined aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm họ tên, email..." aria-label="Tìm kiếm nhân viên" /></label>
        <select className="soft-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái tài khoản"><option value="all">Mọi trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Đã vô hiệu hóa</option></select>
        {isAdmin ? <select className="soft-select" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Lọc khoa/phòng"><option value="all">Tất cả khoa/phòng</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select> : null}
      </div></div>
      {error ? <div className="auth-alert auth-alert-error" role="alert">{error} <button type="button" className="filter-reset" onClick={() => void load()}>Thử lại</button></div> : null}
      {!isAdmin && currentUser?.departmentId == null ? <p className="management-scope-note">Tài khoản chưa được gán khoa/phòng. Vui lòng liên hệ admin để cập nhật.</p> : null}
      <div className="table-scroll"><table className="modern-table management-table"><thead><tr><th>Nhân viên</th><th>Khoa/phòng</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={5} className="empty-table-state">Đang tải danh sách...</td></tr> : visible.length ? visible.map((person) => <tr key={person.id}>
          <td><Link className="staff-cell record-link" href={`/employees/${person.id}`}><span className="staff-avatar" aria-hidden="true">{person.name.trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase()}</span><div><strong>{person.name}</strong><span className="management-email">{person.email}</span></div></Link></td>
          <td>{person.departmentId != null ? <Link className="record-link" href={`/departments/${person.departmentId}`}>{departmentNames.get(Number(person.departmentId)) ?? `Khoa/phòng #${person.departmentId}`}</Link> : "Chưa phân khoa"}</td><td><span className={`management-role role-${person.role}`}>{roleNames[person.role] ?? person.role}</span></td>
          <td><span className={`table-status ${person.isActive ? "status-done" : "status-inactive"}`}>{person.isActive ? "Hoạt động" : "Vô hiệu hóa"}</span></td>
          <td><div className="table-actions"><button type="button" className="mini-action edit" disabled={busy} onClick={() => openEdit(person)}><EditOutlined aria-hidden="true" /> Sửa</button><button type="button" className="mini-action" disabled={busy} onClick={() => void toggleStatus(person)}>{person.isActive ? "Vô hiệu hóa" : "Kích hoạt"}</button>{isAdmin ? <button type="button" className="mini-action delete" disabled={busy} onClick={() => setDeleting(person)} aria-label={`Xóa tài khoản ${person.name}`}><DeleteOutlined aria-hidden="true" /></button> : null}</div></td>
        </tr>) : <tr><td colSpan={5} className="empty-table-state">{query || status !== "all" || departmentFilter !== "all" ? "Không tìm thấy nhân viên phù hợp với bộ lọc." : "Chưa có nhân viên trong phạm vi quản lý."}</td></tr>}
      </tbody></table></div>
    </section>
    {editing ? <ManagementDialog title={editing === "new" ? "Thêm nhân viên" : "Chỉnh sửa nhân viên"} busy={busy} onClose={() => setEditing(null)}><form className="management-form" onSubmit={save}>
      <label>Họ và tên<input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Email công việc<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      {isAdmin ? <><label>{editing === "new" ? "Mật khẩu" : "Mật khẩu mới (bỏ trống để giữ nguyên)"}<PasswordField required={editing === "new"} minLength={6} value={form.password} autoComplete="new-password" onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <div className="management-form-row"><label>Vai trò<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="staff">Nhân viên</option><option value="manager">Trưởng khoa</option><option value="admin">Quản trị viên</option></select></label>
        <label>Khoa/phòng<select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}><option value="">Chưa phân khoa</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label></div></> : <p className="management-scope-note">Khoa/phòng: <strong>{scope}</strong><br />Vai trò: Nhân viên</p>}
      <div className="management-dialog-actions"><button type="button" className="secondary-action" disabled={busy} onClick={() => setEditing(null)}>Hủy</button><button type="submit" className="primary-action" disabled={busy}>{busy ? "Đang lưu..." : "Lưu thông tin"}</button></div>
    </form></ManagementDialog> : null}
    {deleting ? <ManagementDialog title="Xóa tài khoản nhân viên?" busy={busy} onClose={() => setDeleting(null)}><p className="management-delete-copy">Bạn muốn xóa tài khoản <strong>{deleting.name}</strong> ({deleting.email})?</p><div className="management-dialog-actions"><button type="button" className="secondary-action" disabled={busy} onClick={() => setDeleting(null)}>Hủy</button><button type="button" className="danger-action" disabled={busy} onClick={() => void remove()}>{busy ? "Đang xóa..." : "Xóa tài khoản"}</button></div></ManagementDialog> : null}
  </div>;
}
