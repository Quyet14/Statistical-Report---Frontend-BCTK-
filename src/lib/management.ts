export type DepartmentInfo = { id: number; name: string; branchId?: number | null };
export type AccountInfo = {
  id: number; name: string; email: string; role: string; isActive: boolean;
  departmentId?: number | null; departmentName?: string | null;
  branchId?: number | null; createdAt?: string | null;
};

export const accountRoles: Record<string, string> = { admin: "Quản trị viên", manager: "Trưởng khoa", staff: "Nhân viên" };
export const validRecordId = (id: string) => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
export function canViewDepartment(user: { role: string; departmentId?: number | null } | null, id: string) {
  return validRecordId(id) && (user?.role === "admin" || (user?.role === "manager" && user.departmentId != null && Number(user.departmentId) === Number(id)));
}
export function departmentMembers(accounts: AccountInfo[], id: number) {
  return accounts.filter((account) => account.departmentId != null && Number(account.departmentId) === id);
}
export function accountInitials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase() || "?";
}
export function recordError(error: unknown) {
  if (error instanceof Error && "status" in error) {
    if (error.status === 404) return "Thông tin không tồn tại hoặc đã bị xóa.";
    return error.message;
  }
  const message = error instanceof Error ? error.message : "";
  if (/\b403\b/.test(message)) return "Bạn không có quyền xem thông tin này.";
  if (/\b404\b/.test(message)) return "Thông tin không tồn tại hoặc đã bị xóa.";
  if (/\b401\b/.test(message)) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  return "Không thể tải thông tin. Vui lòng thử lại.";
}
export function accountCreatedDate(value?: string | null) {
  if (!value) return "Chưa có thông tin";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có thông tin" : date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
