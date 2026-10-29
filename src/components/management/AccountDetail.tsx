"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { MailOutlined, ApartmentOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { accountRoles, accountInitials, accountCreatedDate, canViewDepartment, validRecordId, type AccountInfo, type DepartmentInfo } from "@/lib/management";
import { DetailBack, DetailStatus, useDetailResource } from "./DetailPrimitives";

export function AccountDetail({ id }: { id?: string }) {
  const [viewer] = useState(getStoredUser);
  const accountId = id ?? String(viewer?.id ?? "");
  const load = useCallback(async () => {
    if (!validRecordId(accountId)) throw new Error("404");
    const account = await api.get<AccountInfo | null>(`/users/${accountId}`);
    if (!account) throw new Error("404");
    let department: DepartmentInfo | null = null;
    if (account.departmentId != null && canViewDepartment(viewer, String(account.departmentId))) {
      department = await api.get<DepartmentInfo | null>(`/departments/${account.departmentId}`);
    }
    return { account, department };
  }, [accountId, viewer]);
  const { data, loading, error, retry } = useDetailResource(load);
  const back = id ? "/employees" : "/checklist";
  if (!data) return <div className="dashboard-page management-page"><DetailBack href={back}>Quay lại</DetailBack><DetailStatus loading={loading} error={error} retry={retry} /></div>;
  const { account, department } = data;
  const departmentName = department?.name ?? account.departmentName ?? (account.departmentId != null ? `Khoa/phòng #${account.departmentId}` : "Chưa phân khoa/phòng");
  const departmentLabel = department && canViewDepartment(viewer, String(department.id)) ? <Link className="record-link" href={`/departments/${department.id}`}>{departmentName}</Link> : departmentName;
  return <div className="dashboard-page management-page detail-page" data-page="settings">
    <DetailBack href={back}>{id ? "Quay lại nhân viên" : "Quay lại công việc"}</DetailBack>
    <section className="detail-hero account-hero"><span className="detail-profile-avatar" aria-hidden="true">{accountInitials(account.name)}</span><div><p className="detail-eyebrow">HỒ SƠ TÀI KHOẢN</p><h1>{account.name}</h1><p>{accountRoles[account.role] ?? account.role} · {departmentName}</p></div><span className={`table-status ${account.isActive ? "status-done" : "status-inactive"}`}>{account.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}</span></section>
    <div className="account-detail-grid"><section className="panel-card detail-information"><h2>Thông tin tài khoản</h2><dl className="detail-fields"><div><dt>Họ và tên</dt><dd>{account.name}</dd></div><div><dt>Mã tài khoản</dt><dd>#{account.id}</dd></div><div><dt>Email công việc</dt><dd><a className="record-link" href={`mailto:${account.email}`}>{account.email}</a></dd></div><div><dt>Vai trò</dt><dd><span className={`management-role role-${account.role}`}>{accountRoles[account.role] ?? account.role}</span></dd></div><div><dt>Khoa/phòng</dt><dd>{departmentLabel}</dd></div><div><dt>Mã khoa/phòng</dt><dd>{account.departmentId != null ? `#${account.departmentId}` : "Chưa phân công"}</dd></div><div><dt>Mã chi nhánh tài khoản</dt><dd>{account.branchId ?? "Chưa phân chi nhánh"}</dd></div><div><dt>Ngày tạo tài khoản</dt><dd>{accountCreatedDate(account.createdAt)}</dd></div><div><dt>Trạng thái</dt><dd>{account.isActive ? "Hoạt động" : "Vô hiệu hóa"}</dd></div></dl></section>
      <aside className="panel-card account-overview"><h2>Tổng quan hồ sơ</h2><div className="account-overview-item"><MailOutlined aria-hidden="true" /><div><span>Liên hệ công việc</span><a className="record-link" href={`mailto:${account.email}`}>{account.email}</a></div></div><div className="account-overview-item"><ApartmentOutlined aria-hidden="true" /><div><span>Khoa/phòng</span><strong>{departmentLabel}</strong></div></div><div className="account-overview-item"><SafetyCertificateOutlined aria-hidden="true" /><div><span>Quyền tài khoản</span><strong>{accountRoles[account.role] ?? account.role}</strong></div></div>{department ? <Link className="detail-department-action" href={`/departments/${department.id}`}>Xem đội ngũ khoa/phòng →</Link> : null}</aside>
    </div>
  </div>;
}
