"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PasswordField } from "@/components/common/PasswordField";

type User = { id: number; name: string; role: string; departmentId?: number; email: string; isActive: boolean };
type Department = { id: number; name: string; branchId?: number };

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "staff", departmentId: "" });
  const [departmentForm, setDepartmentForm] = useState({ name: "", branchId: "" });
  const [message, setMessage] = useState("");
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isDepartmentFormOpen, setIsDepartmentFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ type: "user" | "department"; id: number; name: string } | null>(null);

  const loadData = async () => {
    try {
      const [userRows, departmentRows] = await Promise.all([api.get<User[]>("/users"), api.get<Department[]>("/departments")]);
      setUsers(userRows);
      setDepartments(departmentRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu quản trị");
    }
  };

  useEffect(() => { void loadData(); }, []);

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...userForm, departmentId: userForm.departmentId ? Number(userForm.departmentId) : undefined };
    if (editingUserId) {
      await api.patch(`/users/${editingUserId}`, { ...payload, password: payload.password || undefined });
    } else {
      await api.post("/users", payload);
    }
    setUserForm({ name: "", email: "", password: "", role: "staff", departmentId: "" });
    setEditingUserId(null);
    setMessage(editingUserId ? "Đã cập nhật người dùng" : "Đã tạo người dùng");
    setIsUserFormOpen(false);
    await loadData();
  };

  const saveDepartment = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { name: departmentForm.name.trim(), branchId: departmentForm.branchId ? Number(departmentForm.branchId) : undefined };
    if (editingDepartmentId) await api.patch(`/departments/${editingDepartmentId}`, payload);
    else await api.post("/departments", payload);
    setDepartmentForm({ name: "", branchId: "" });
    setEditingDepartmentId(null);
    setMessage(editingDepartmentId ? "Đã cập nhật phòng ban" : "Đã tạo phòng ban");
    setIsDepartmentFormOpen(false);
    await loadData();
  };

  const editUser = (user: User) => {
    setEditingUserId(user.id);
    setUserForm({ name: user.name, email: user.email, password: "", role: user.role, departmentId: user.departmentId?.toString() ?? "" });
    setIsUserFormOpen(true);
  };

  const editDepartment = (department: Department) => {
    setEditingDepartmentId(department.id);
    setDepartmentForm({ name: department.name, branchId: department.branchId?.toString() ?? "" });
    setIsDepartmentFormOpen(true);
  };

  const toggleUser = async (user: User) => {
    await api.patch(`/users/${user.id}`, { isActive: !user.isActive });
    setMessage(user.isActive ? "Đã vô hiệu hoá người dùng" : "Đã kích hoạt người dùng");
    await loadData();
  };

  const deleteUser = async (user: User) => {
    setPendingDelete({ type: "user", id: user.id, name: user.name });
  };

  const deleteDepartment = async (department: Department) => {
    setPendingDelete({ type: "department", id: department.id, name: department.name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await api.del(`/${pendingDelete.type === "user" ? "users" : "departments"}/${pendingDelete.id}`);
    setPendingDelete(null);
    setMessage(pendingDelete.type === "user" ? "Đã xoá người dùng" : "Đã xoá phòng ban");
    await loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div><span className="eyebrow">Cấu hình</span><h3 className="page-title">Người dùng và phòng ban</h3></div>
        {message ? <span className="status-badge success">{message}</span> : null}
      </div>

      <div className="settings-grid">
        <div className="panel-card setting-card">
          <h4>Người dùng</h4>
          <p className="setting-content">Tạo tài khoản và phân quyền người dùng.</p>
          <button className="primary-action" type="button" onClick={() => { setEditingUserId(null); setIsUserFormOpen(true); }}>＋ Tạo người dùng</button>
        </div>
        <div className="panel-card setting-card">
          <h4>Phòng ban</h4>
          <p className="setting-content">Tạo phòng ban để gán cho người dùng.</p>
          <button className="primary-action" type="button" onClick={() => { setEditingDepartmentId(null); setIsDepartmentFormOpen(true); }}>＋ Tạo phòng ban</button>
        </div>
      </div>

      {isUserFormOpen ? <div className="modal-backdrop" onClick={() => setIsUserFormOpen(false)}>
        <form className="task-modal settings-modal admin-form" onSubmit={saveUser} onClick={(event) => event.stopPropagation()}>
          <h4>{editingUserId ? "Sửa người dùng" : "Tạo người dùng"}</h4>
          <input required placeholder="Họ và tên" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} />
          <input required type="email" placeholder="Email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} />
          <PasswordField required={!editingUserId} minLength={6} placeholder={editingUserId ? "Mật khẩu mới (bỏ trống nếu không đổi)" : "Mật khẩu"} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
          <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option value="staff">User</option><option value="manager">Trưởng phòng</option><option value="admin">Admin</option></select>
          <select value={userForm.departmentId} onChange={(event) => setUserForm({ ...userForm, departmentId: event.target.value })}><option value="">Chọn phòng ban</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
          <button className="primary-action" type="submit">{editingUserId ? "Lưu thay đổi" : "Tạo người dùng"}</button>
          <button type="button" className="secondary-action" onClick={() => setIsUserFormOpen(false)}>Hủy</button>
        </form>
      </div> : null}

      {isDepartmentFormOpen ? <div className="modal-backdrop" onClick={() => setIsDepartmentFormOpen(false)}>
        <form className="task-modal settings-modal admin-form" onSubmit={saveDepartment} onClick={(event) => event.stopPropagation()}>
          <h4>{editingDepartmentId ? "Sửa phòng ban" : "Tạo phòng ban"}</h4>
          <input required placeholder="Tên phòng ban" value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} />
          <input type="number" min="1" placeholder="Mã chi nhánh" value={departmentForm.branchId} onChange={(event) => setDepartmentForm({ ...departmentForm, branchId: event.target.value })} />
          <div className="task-modal-actions"><button type="button" className="secondary-action" onClick={() => setIsDepartmentFormOpen(false)}>Hủy</button><button className="primary-action" type="submit">{editingDepartmentId ? "Lưu thay đổi" : "Tạo phòng ban"}</button></div>
        </form>
      </div> : null}

      <div className="settings-grid">
        <div className="panel-card table-card"><h4>Người dùng</h4><table className="modern-table"><thead><tr><th>Tên</th><th>Email</th><th>Vai trò</th><th>Phòng ban</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{users.length ? users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{departments.find((department) => department.id === user.departmentId)?.name ?? "-"}</td><td>{user.isActive ? "Đang hoạt động" : "Đã vô hiệu hoá"}</td><td className="table-actions"><button className="mini-action edit" type="button" onClick={() => editUser(user)}>Sửa</button><button className="mini-action" type="button" onClick={() => void toggleUser(user)}>{user.isActive ? "Vô hiệu hoá" : "Kích hoạt"}</button><button className="mini-action delete" type="button" onClick={() => void deleteUser(user)}>Xoá</button></td></tr>) : <tr><td colSpan={6}>Chưa có dữ liệu</td></tr>}</tbody></table></div>
        <div className="panel-card table-card"><h4>Phòng ban</h4><table className="modern-table"><thead><tr><th>Tên phòng ban</th><th>Chi nhánh</th><th>Thao tác</th></tr></thead><tbody>{departments.length ? departments.map((department) => <tr key={department.id}><td>{department.name}</td><td>{department.branchId ?? "-"}</td><td className="table-actions"><button className="mini-action edit" type="button" onClick={() => editDepartment(department)}>Sửa</button><button className="mini-action delete" type="button" onClick={() => void deleteDepartment(department)}>Xoá</button></td></tr>) : <tr><td colSpan={3}>Chưa có dữ liệu</td></tr>}</tbody></table></div>
      </div>

      {pendingDelete ? <div className="modal-backdrop" onClick={() => setPendingDelete(null)}>
        <div className="task-modal settings-confirm" onClick={(event) => event.stopPropagation()}>
          <h3>Xác nhận xoá</h3>
          <p>Bạn có chắc muốn xoá {pendingDelete.type === "user" ? "người dùng" : "phòng ban"} <strong>{pendingDelete.name}</strong> không?</p>
          <div className="task-modal-actions"><button type="button" className="secondary-action" onClick={() => setPendingDelete(null)}>Hủy</button><button type="button" className="danger-action" onClick={() => void confirmDelete()}>Xoá</button></div>
        </div>
      </div> : null}
    </div>
  );
}
