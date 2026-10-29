"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ApartmentOutlined, TeamOutlined, UserSwitchOutlined, StopOutlined, SearchOutlined, RightOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { accountRoles, accountInitials, canViewDepartment, departmentMembers, validRecordId, type AccountInfo, type DepartmentInfo } from "@/lib/management";
import { SummaryCard } from "@/components/common/SummaryCard";
import { DetailBack, DetailStatus, useDetailResource } from "./DetailPrimitives";

export function DepartmentDetail({ id }: { id: string }) {
  const [viewer] = useState(getStoredUser);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const load = useCallback(async () => {
    if (!validRecordId(id)) throw new Error("404");
    if (!canViewDepartment(viewer, id)) throw new Error("403");
    const [department, accounts] = await Promise.all([api.get<DepartmentInfo | null>(`/departments/${id}`), api.get<AccountInfo[]>("/users")]);
    if (!department) throw new Error("404");
    return { department, members: departmentMembers(accounts, Number(id)) };
  }, [id, viewer]);
  const { data, loading, error, retry } = useDetailResource(load);
  const back = viewer?.role === "admin" ? "/departments" : "/employees";
  if (!data) return <div className="dashboard-page management-page"><DetailBack href={back}>Quay lại danh sách</DetailBack><DetailStatus loading={loading} error={error} retry={retry} /></div>;
  const { department, members } = data;
  const heads = members.filter((member) => member.role === "manager");
  const active = members.filter((member) => member.isActive).length;
  const visible = members.filter((member) => [member.name, member.email].some((value) => value.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))) && (status === "all" || Boolean(member.isActive) === (status === "active")));
  return <div className="dashboard-page management-page detail-page" data-page="settings">
    <DetailBack href={back}>Quay lại {viewer?.role === "admin" ? "khoa/phòng" : "nhân viên"}</DetailBack>
    <section className="detail-hero"><span className="detail-hero-icon" aria-hidden="true"><ApartmentOutlined /></span><div><p className="detail-eyebrow">HỒ SƠ KHOA / PHÒNG</p><h1>{department.name}</h1><p>Thông tin tổ chức và đội ngũ nhân sự trong khoa/phòng.</p></div><span className="detail-record-id">Mã khoa #{department.id}</span></section>
    <div className="stats-grid"><SummaryCard label="Tổng nhân sự" value={members.length} tone="blue" icon={<TeamOutlined />} /><SummaryCard label="Đang hoạt động" value={active} tone="green" icon={<UserSwitchOutlined />} /><SummaryCard label="Đã vô hiệu hóa" value={members.length - active} tone="amber" icon={<StopOutlined />} /></div>
    <section className="panel-card detail-information"><h2>Thông tin khoa/phòng</h2><dl className="detail-fields"><div><dt>Tên khoa/phòng</dt><dd>{department.name}</dd></div><div><dt>Mã khoa/phòng</dt><dd>#{department.id}</dd></div><div><dt>Mã chi nhánh</dt><dd>{department.branchId ?? "Chưa phân chi nhánh"}</dd></div><div><dt>Trưởng khoa</dt><dd>{heads.length ? heads.map((head, index) => <span key={head.id}>{index > 0 ? ", " : ""}<Link className="record-link" href={`/employees/${head.id}`}>{head.name}</Link></span>) : "Chưa phân công"}</dd></div><div><dt>Nhân viên</dt><dd>{members.filter((member) => member.role === "staff").length} tài khoản nhân viên</dd></div><div><dt>Trưởng khoa</dt><dd>{heads.length} tài khoản trưởng khoa</dd></div></dl></section>
    <section className="panel-card management-directory" aria-label="Nhân sự thuộc khoa phòng"><div className="management-toolbar"><div><h2>Đội ngũ nhân sự</h2><span>{visible.length}/{members.length} nhân sự · Bấm vào tên để xem hồ sơ</span></div><div className="management-filters"><label className="management-search"><SearchOutlined aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm họ tên, email..." aria-label="Tìm nhân sự trong khoa" /></label><select className="soft-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Lọc trạng thái"><option value="all">Mọi trạng thái</option><option value="active">Đang hoạt động</option><option value="inactive">Đã vô hiệu hóa</option></select></div></div>
      <div className="table-scroll"><table className="modern-table management-table detail-members-table"><thead><tr><th>Nhân sự</th><th>Email công việc</th><th>Vai trò</th><th>Trạng thái</th><th>Hồ sơ</th></tr></thead><tbody>{visible.length ? visible.map((member) => <tr key={member.id}><td><Link className="staff-cell record-link" href={`/employees/${member.id}`}><span className="staff-avatar" aria-hidden="true">{accountInitials(member.name)}</span><strong>{member.name}</strong></Link></td><td>{member.email}</td><td><span className={`management-role role-${member.role}`}>{accountRoles[member.role] ?? member.role}</span></td><td><span className={`table-status ${member.isActive ? "status-done" : "status-inactive"}`}>{member.isActive ? "Hoạt động" : "Vô hiệu hóa"}</span></td><td><Link className="record-link detail-open-link" href={`/employees/${member.id}`}>Xem hồ sơ <RightOutlined aria-hidden="true" /></Link></td></tr>) : <tr><td colSpan={5} className="empty-table-state">{members.length ? "Không có nhân sự phù hợp với bộ lọc." : "Khoa/phòng chưa có nhân sự được phân công."}</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
