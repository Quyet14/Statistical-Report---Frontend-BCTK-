"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { LocalizedDom } from "./LocalizedDom";

export const UI_STRINGS = {
  "nav.today": "Việc hôm nay",
  "nav.personal": "Việc cá nhân",
  "nav.tasks": "Điều phối việc",
  "nav.archive": "Lưu trữ",
  "nav.workflow": "Duyệt & công việc lặp lại",
  "nav.hospital": "Nghiệp vụ bệnh viện",
  "nav.programs": "SOP, trực & chất lượng",
  "nav.notifications": "Trung tâm thông báo",
  "nav.reports": "Giao ban",
  "nav.kpi": "KPI",
  "nav.employees": "Quản lý nhân viên",
  "nav.departments": "Quản lý khoa/phòng",
  "nav.organization": "Cơ cấu & nhóm",
  "nav.settings": "Sao lưu & vận hành",
  "group.work": "Công việc",
  "group.management": "Quản lý",
  "sidebar.menu": "Menu chính",
  "sidebar.navigation": "Điều hướng không gian làm việc",
  "sidebar.operations": "Điều phối vận hành",
  "sidebar.expand": "Mở rộng",
  "sidebar.collapse": "Thu gọn",
  "sidebar.expandMenu": "Bấm để mở rộng menu",
  "sidebar.collapseMenu": "Bấm để thu gọn menu",
  "sidebar.logo": "Logo bệnh viện",
  "header.workspace": "Không gian làm việc Bệnh viện Hữu Nghị",
  "header.assign": "Giao việc",
  "header.notifications": "Thông báo",
  "header.notificationPanel": "Bảng thông báo",
  "header.operationsNotifications": "Thông báo vận hành",
  "header.updates": "cập nhật",
  "header.emptyNotifications": "Chưa có cập nhật mới về nhiệm vụ",
  "header.account": "Hồ sơ tài khoản",
  "header.logout": "Đăng xuất",
  "header.logoutError": "Chưa thể đăng xuất",
  "header.retryConnection": "Vui lòng kiểm tra kết nối và thử lại.",
  "header.welcome": "Một ngày hiệu quả.",
  "header.welcomeSub": "Cùng nhau tạo khác biệt.",
  "task.new": "Giao việc mới",
  "task.title": "Nội dung công việc",
  "task.titleEnglish": "Tiêu đề tiếng Anh (không bắt buộc)",
  "task.titlePlaceholder": "Nhập nội dung công việc",
  "task.assignee": "Người phụ trách",
  "task.chooseUser": "Chọn người dùng",
  "task.time": "Thời gian",
  "task.reviewer": "Người duyệt",
  "task.noReview": "Không yêu cầu duyệt",
  "task.reviewHelp":
    "Việc cần duyệt chỉ được tính hoàn thành sau khi người duyệt xác nhận.",
  "task.status": "Trạng thái",
  "task.todo": "Chưa bắt đầu",
  "task.doing": "Đang làm",
  "task.done": "Hoàn thành",
  "task.priority": "Mức độ ưu tiên",
  "task.low": "Thấp",
  "task.medium": "Trung bình",
  "task.high": "Cao",
  "task.progress": "Tiến độ",
  "task.checklist": "Checklist công việc",
  "task.checklistPlaceholder":
    "Mỗi dòng là một công việc\nVí dụ: Kiểm tra tài liệu\nGửi báo cáo cho trưởng phòng",
  "task.checklistEnglish": "Checklist tiếng Anh (cùng thứ tự, không bắt buộc)",
  "task.sopTitleEnglish": "Tiêu đề tiếng Anh (không bắt buộc)",
  "task.sopDescriptionEnglish": "Mô tả tiếng Anh (không bắt buộc)",
  "task.sopContentEnglish": "Nội dung SOP tiếng Anh (không bắt buộc)",
  "task.cancel": "Hủy",
  "task.saving": "Đang lưu...",
  "language.label": "Ngôn ngữ",
  "language.vietnamese": "Tiếng Việt",
  "language.english": "English",
  "language.loading": "Đang tải bản dịch giao diện...",
  "language.error": "Không tải được bản dịch giao diện.",
  "taskCard.completed": "HOÀN THÀNH",
  "taskCard.priorityLow": "Thấp",
  "taskCard.priorityMedium": "Trung bình",
  "taskCard.priorityHigh": "Ưu tiên cao",
  "taskCard.progress": "Tiến độ",
  "taskCard.numberRequired": "Cần nhập giá trị số",
  "taskCard.value": "Giá trị",
  "taskCard.acknowledgedBy": "Đã xác nhận bởi",
  "taskCard.needsSignature": "Cần ký xác nhận",
  "taskCard.failed": "Không đạt",
  "taskCard.reportFailure": "Báo không đạt",
  "taskCard.addChecklistItem": "Thêm mục công việc",
  "taskCard.enterContent": "Nhập nội dung...",
  "taskCard.newItemLabel": "Nội dung mục công việc mới",
  "taskCard.saving": "Đang lưu...",
  "taskCard.add": "Thêm",
  "taskCard.edit": "Sửa",
  "taskCard.delete": "Xóa",
  "taskCard.updateInfo": "Cập nhật thông tin",
  "taskCard.editTask": "Chỉnh sửa công việc",
  "taskCard.closeEdit": "Đóng cửa sổ chỉnh sửa",
  "taskCard.title": "Tiêu đề công việc",
  "taskCard.assignee": "Người phụ trách",
  "taskCard.assignmentHelp": "Thay đổi phân công tại trang điều phối",
  "taskCard.dueDate": "Hạn chót",
  "taskCard.status": "Trạng thái",
  "taskCard.todo": "Chưa bắt đầu",
  "taskCard.doing": "Đang làm",
  "taskCard.done": "Hoàn thành",
  "taskCard.priority": "Mức độ ưu tiên",
  "taskCard.low": "Thấp",
  "taskCard.medium": "Trung bình",
  "taskCard.high": "Cao",
  "taskCard.cancel": "Hủy",
  "taskCard.saveChanges": "Lưu thay đổi",
  "taskCard.confirmDelete": "Xác nhận xóa công việc",
  "taskCard.confirmDeleteMessage": "Bạn có chắc muốn xóa công việc này? Thao tác này sẽ xóa công việc khỏi danh sách hiện tại.",
  "taskCard.deleteTask": "Xóa công việc",
  "workflow.draft": "Cần người duyệt xác nhận",
  "workflow.submitted": "Chờ duyệt · Đã khóa chỉnh sửa",
  "workflow.approved": "Đã duyệt · Checklist đã khóa",
  "workflow.approvedShort": "Đã duyệt",
  "workflow.rejected": "Bị từ chối · Cần bổ sung",
  "workflow.delegated": "Bạn đang duyệt theo ủy quyền còn hiệu lực. Nhật ký sẽ ghi người thực hiện duyệt thay.",
  "workflow.participant": "Bạn đang phối hợp thực hiện; người phụ trách chính sẽ gửi duyệt.",
  "workflow.level": "Cấp",
  "workflow.needsChanges": "Cần bổ sung",
  "workflow.awaitingReview": "Chờ duyệt",
  "workflow.reason": "Lý do nếu từ chối",
  "workflow.additionalContent": "Nội dung cần bổ sung…",
  "workflow.approveComplete": "Duyệt hoàn thành",
  "workflow.approveLevel": "Duyệt cấp",
  "workflow.reject": "Từ chối",
  "workflow.reopen": "Mở khóa để chỉnh sửa",
  "checklist.overview": "Tổng quan vận hành",
  "checklist.todayTitle": "Việc cần làm hôm nay",
  "checklist.period": "Chọn khoảng thời gian",
  "checklist.today": "Hôm nay",
  "checklist.thisWeek": "Tuần này",
  "checklist.allTasks": "Tất cả công việc",
  "checklist.completed": "Hoàn thành",
  "checklist.inProgress": "Đang làm",
  "checklist.notStarted": "Chưa bắt đầu",
  "checklist.completedWork": "Đã hoàn tất công việc",
  "checklist.workInProgress": "Đang được triển khai",
  "checklist.readyToStart": "Sẵn sàng để bắt đầu",
  "checklist.board": "Bảng công việc",
  "checklist.completedRate": "Tỷ lệ công việc hoàn thành",
  "checklist.todoColumn": "Chờ xử lý",
  "checklist.todoHint": "Việc mới giao hoặc chưa bắt đầu",
  "checklist.doingColumn": "Đang làm",
  "checklist.doingHint": "Đang được khoa/phòng xử lý",
  "checklist.doneColumn": "Hoàn thành",
  "checklist.doneHint": "Đã kết thúc hoặc đã được ghi nhận",
  "checklist.emptyColumn": "Chưa có công việc trong cột này",
  "tasks.execution": "Thực thi",
  "tasks.title": "Quản lý nhiệm vụ",
  "tasks.list": "Danh sách nhiệm vụ",
  "tasks.displaying": "công việc đang hiển thị",
  "tasks.departmentFilter": "Lọc theo phòng ban",
  "tasks.allDepartments": "Tất cả phòng ban",
  "tasks.statusFilter": "Lọc theo trạng thái",
  "tasks.allStatuses": "Tất cả trạng thái",
  "tasks.allTasks": "Tất cả nhiệm vụ",
  "tasks.calendarFilter": "Lọc theo ngày",
  "tasks.viewCalendar": "Xem lịch công việc",
  "tasks.previousMonth": "Tháng trước",
  "tasks.nextMonth": "Tháng sau",
  "tasks.dayTasks": "Nhiệm vụ ngày",
  "tasks.taskCount": "nhiệm vụ",
  "tasks.viewAllDays": "Xem tất cả ngày",
  "tasks.selectCalendarDate": "Chọn ngày trên lịch để lọc danh sách bên dưới.",
  "tasks.task": "Nhiệm vụ",
  "tasks.department": "Phòng ban",
  "tasks.assignee": "Người phụ trách",
  "tasks.status": "Trạng thái",
  "tasks.dueDate": "Hạn chót",
  "tasks.empty": "Chưa có công việc phù hợp với bộ lọc.",
  "tasks.detail": "Chi tiết nhiệm vụ",
  "tasks.close": "Đóng",
  "tasks.progress": "Tiến độ thực hiện",
  "tasks.checklist": "Checklist công việc",
  "tasks.items": "mục",
  "tasks.noChecklist": "Công việc này chưa có checklist.",
  "roleDashboard.admin": "Điều hành toàn viện",
  "roleDashboard.manager": "Tổng quan khoa/phòng",
  "roleDashboard.leader": "Điều hành nhóm",
  "roleDashboard.staff": "Không gian thực hiện cá nhân",
  "roleDashboard.viewer": "Theo dõi vận hành toàn viện",
  "roleDashboard.staffHeadline": "Tập trung vào việc quan trọng hôm nay.",
  "roleDashboard.viewerHeadline": "Nắm nhịp hoạt động. Theo dõi chất lượng.",
  "roleDashboard.managerHeadline": "Nhận diện điểm cần xử lý, điều phối đúng lúc.",
  "roleDashboard.workCount": "công việc trong phạm vi",
  "roleDashboard.complete": "hoàn thành",
  "roleDashboard.day": "Ngày",
  "roleDashboard.pendingHandoffs": "bàn giao đang chờ",
  "roleDashboard.viewKpi": "Xem KPI",
  "roleDashboard.goToWork": "Đến khu vực xử lý",
  "roleDashboard.dueToday": "Cần làm hôm nay",
  "roleDashboard.missingFields": "Mục số/ký còn thiếu",
  "roleDashboard.recordedToday": "Đã ghi nhận hôm nay",
  "roleDashboard.awaitingApproval": "Chờ phê duyệt",
  "roleDashboard.awaitingMyReview": "Chờ tôi duyệt",
  "roleDashboard.overdue": "Công việc quá hạn",
  "roleDashboard.departmentsWithWork": "Khoa có công việc",
  "roleDashboard.peopleWithWork": "Người có công việc",
  "roleDashboard.details": "Xem chi tiết",
  "roleDashboard.lastSevenDays": "Hoàn thành 7 ngày gần nhất",
  "roleDashboard.departmentsToWatch": "Các khoa cần theo dõi",
  "roleDashboard.workDistribution": "Phân bổ công việc",
  "roleDashboard.completed": "xong",
  "roleDashboard.late": "trễ",
  "roleDashboard.policyNote": "Chỉ ghi nhận hoàn tất sau khi đủ cấp duyệt. Các số liệu lấy từ phạm vi tài khoản hiện tại.",
} as const;

type UiKey = keyof typeof UI_STRINGS;

export const UI_ENGLISH: Record<UiKey, string> = {
  "nav.today": "Today's work",
  "nav.personal": "Personal work",
  "nav.tasks": "Task coordination",
  "nav.archive": "Archive",
  "nav.workflow": "Approvals & recurring work",
  "nav.hospital": "Hospital operations",
  "nav.programs": "SOP, shifts & quality",
  "nav.notifications": "Notification center",
  "nav.reports": "Reports",
  "nav.kpi": "KPI",
  "nav.employees": "Employee management",
  "nav.departments": "Department management",
  "nav.organization": "Organization & teams",
  "nav.settings": "Backup & operations",
  "group.work": "Work",
  "group.management": "Management",
  "sidebar.menu": "Main menu",
  "sidebar.navigation": "Workspace navigation",
  "sidebar.operations": "Operations coordination",
  "sidebar.expand": "Expand",
  "sidebar.collapse": "Collapse",
  "sidebar.expandMenu": "Click to expand the menu",
  "sidebar.collapseMenu": "Click to collapse the menu",
  "sidebar.logo": "Hospital logo",
  "header.workspace": "Huu Nghi Hospital workspace",
  "header.assign": "Assign task",
  "header.notifications": "Notifications",
  "header.notificationPanel": "Notification panel",
  "header.operationsNotifications": "Operations notifications",
  "header.updates": "updates",
  "header.emptyNotifications": "No new task updates",
  "header.account": "Account profile",
  "header.logout": "Sign out",
  "header.logoutError": "Unable to sign out",
  "header.retryConnection": "Check your connection and try again.",
  "header.welcome": "Make today productive.",
  "header.welcomeSub": "Together, we make a difference.",
  "task.new": "Assign a new task",
  "task.title": "Task title",
  "task.titleEnglish": "English title (optional)",
  "task.titlePlaceholder": "Enter task details",
  "task.assignee": "Assignee",
  "task.chooseUser": "Choose a user",
  "task.time": "Due date",
  "task.reviewer": "Reviewer",
  "task.noReview": "No review required",
  "task.reviewHelp": "Tasks requiring review are complete only after the reviewer approves them.",
  "task.status": "Status",
  "task.todo": "Not started",
  "task.doing": "In progress",
  "task.done": "Completed",
  "task.priority": "Priority",
  "task.low": "Low",
  "task.medium": "Medium",
  "task.high": "High",
  "task.progress": "Progress",
  "task.checklist": "Task checklist",
  "task.checklistPlaceholder": "One task per line\nExample: Review the document\nSend the report to the department head",
  "task.checklistEnglish": "English checklist (same order, optional)",
  "task.sopTitleEnglish": "English title (optional)",
  "task.sopDescriptionEnglish": "English description (optional)",
  "task.sopContentEnglish": "English SOP content (optional)",
  "task.cancel": "Cancel",
  "task.saving": "Saving...",
  "language.label": "Language",
  "language.vietnamese": "Tiếng Việt",
  "language.english": "English",
  "language.loading": "Loading interface translation...",
  "language.error": "Unable to load interface translations.",
  "taskCard.completed": "COMPLETED",
  "taskCard.priorityLow": "Low",
  "taskCard.priorityMedium": "Medium",
  "taskCard.priorityHigh": "High",
  "taskCard.progress": "Progress",
  "taskCard.numberRequired": "Enter a numeric value",
  "taskCard.value": "Value",
  "taskCard.acknowledgedBy": "Acknowledged by",
  "taskCard.needsSignature": "Signature required",
  "taskCard.failed": "Failed",
  "taskCard.reportFailure": "Report failure",
  "taskCard.addChecklistItem": "Add checklist item",
  "taskCard.enterContent": "Enter content...",
  "taskCard.newItemLabel": "New checklist item",
  "taskCard.saving": "Saving...",
  "taskCard.add": "Add",
  "taskCard.edit": "Edit",
  "taskCard.delete": "Delete",
  "taskCard.updateInfo": "Update information",
  "taskCard.editTask": "Edit task",
  "taskCard.closeEdit": "Close edit window",
  "taskCard.title": "Task title",
  "taskCard.assignee": "Assignee",
  "taskCard.assignmentHelp": "Change the assignment on the coordination page",
  "taskCard.dueDate": "Due date",
  "taskCard.status": "Status",
  "taskCard.todo": "Not started",
  "taskCard.doing": "In progress",
  "taskCard.done": "Completed",
  "taskCard.priority": "Priority",
  "taskCard.low": "Low",
  "taskCard.medium": "Medium",
  "taskCard.high": "High",
  "taskCard.cancel": "Cancel",
  "taskCard.saveChanges": "Save changes",
  "taskCard.confirmDelete": "Confirm task deletion",
  "taskCard.confirmDeleteMessage": "Are you sure you want to delete this task? It will be removed from the current list.",
  "taskCard.deleteTask": "Delete task",
  "workflow.draft": "Awaiting reviewer confirmation",
  "workflow.submitted": "Pending review · Editing locked",
  "workflow.approved": "Approved · Checklist locked",
  "workflow.approvedShort": "Approved",
  "workflow.rejected": "Rejected · Changes required",
  "workflow.delegated": "You are reviewing under an active delegation. The audit log will record you as the acting reviewer.",
  "workflow.participant": "You are collaborating; the task owner will submit it for review.",
  "workflow.level": "Level",
  "workflow.needsChanges": "Changes required",
  "workflow.awaitingReview": "Pending review",
  "workflow.reason": "Reason for rejection",
  "workflow.additionalContent": "Additional information required…",
  "workflow.approveComplete": "Approve completion",
  "workflow.approveLevel": "Approve level",
  "workflow.reject": "Reject",
  "workflow.reopen": "Unlock for editing",
  "checklist.overview": "Operations overview",
  "checklist.todayTitle": "Today's tasks",
  "checklist.period": "Select a time period",
  "checklist.today": "Today",
  "checklist.thisWeek": "This week",
  "checklist.allTasks": "All tasks",
  "checklist.completed": "Completed",
  "checklist.inProgress": "In progress",
  "checklist.notStarted": "Not started",
  "checklist.completedWork": "Work completed",
  "checklist.workInProgress": "In progress",
  "checklist.readyToStart": "Ready to start",
  "checklist.board": "Task board",
  "checklist.completedRate": "Task completion rate",
  "checklist.todoColumn": "To do",
  "checklist.todoHint": "Newly assigned or not started",
  "checklist.doingColumn": "In progress",
  "checklist.doingHint": "Being handled by the department",
  "checklist.doneColumn": "Completed",
  "checklist.doneHint": "Finished or recorded as complete",
  "checklist.emptyColumn": "No tasks in this column",
  "tasks.execution": "Execution",
  "tasks.title": "Task management",
  "tasks.list": "Task list",
  "tasks.displaying": "tasks displayed",
  "tasks.departmentFilter": "Filter by department",
  "tasks.allDepartments": "All departments",
  "tasks.statusFilter": "Filter by status",
  "tasks.allStatuses": "All statuses",
  "tasks.allTasks": "All tasks",
  "tasks.calendarFilter": "Filter by date",
  "tasks.viewCalendar": "View task calendar",
  "tasks.previousMonth": "Previous month",
  "tasks.nextMonth": "Next month",
  "tasks.dayTasks": "Tasks on",
  "tasks.taskCount": "tasks",
  "tasks.viewAllDays": "View all days",
  "tasks.selectCalendarDate": "Select a date on the calendar to filter the list below.",
  "tasks.task": "Task",
  "tasks.department": "Department",
  "tasks.assignee": "Assignee",
  "tasks.status": "Status",
  "tasks.dueDate": "Due date",
  "tasks.empty": "No tasks match the selected filters.",
  "tasks.detail": "Task details",
  "tasks.close": "Close",
  "tasks.progress": "Progress",
  "tasks.checklist": "Task checklist",
  "tasks.items": "items",
  "tasks.noChecklist": "This task has no checklist.",
  "roleDashboard.admin": "Hospital-wide operations",
  "roleDashboard.manager": "Department overview",
  "roleDashboard.leader": "Team operations",
  "roleDashboard.staff": "Personal workspace",
  "roleDashboard.viewer": "Hospital-wide operations monitoring",
  "roleDashboard.staffHeadline": "Focus on what matters today.",
  "roleDashboard.viewerHeadline": "Stay informed. Monitor quality.",
  "roleDashboard.managerHeadline": "Identify what needs attention and coordinate in time.",
  "roleDashboard.workCount": "tasks in scope",
  "roleDashboard.complete": "completed",
  "roleDashboard.day": "Date",
  "roleDashboard.pendingHandoffs": "handoffs pending",
  "roleDashboard.viewKpi": "View KPI",
  "roleDashboard.goToWork": "Go to work queue",
  "roleDashboard.dueToday": "Due today",
  "roleDashboard.missingFields": "Missing numeric/signature fields",
  "roleDashboard.recordedToday": "Recorded today",
  "roleDashboard.awaitingApproval": "Awaiting approval",
  "roleDashboard.awaitingMyReview": "Awaiting my review",
  "roleDashboard.overdue": "Overdue tasks",
  "roleDashboard.departmentsWithWork": "Departments with tasks",
  "roleDashboard.peopleWithWork": "People with tasks",
  "roleDashboard.details": "View details",
  "roleDashboard.lastSevenDays": "Completed in the last 7 days",
  "roleDashboard.departmentsToWatch": "Departments to monitor",
  "roleDashboard.workDistribution": "Task distribution",
  "roleDashboard.completed": "completed",
  "roleDashboard.late": "late",
  "roleDashboard.policyNote": "Completion is recorded only after all approval steps. Metrics reflect the current account's scope.",
};

export type UiLocale = "vi" | "en";
type TranslationPage = {
  translations: Record<string, string>;
  offset: number;
  total: number;
};
type LocaleContextValue = {
  locale: UiLocale;
  loading: boolean;
  error: string | null;
  t: (key: UiKey) => string;
  setLocale: (locale: UiLocale) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function saveLocale(locale: UiLocale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function LocaleProvider({
  children,
  initialLocale = "vi",
}: {
  children: ReactNode;
  initialLocale?: UiLocale;
}) {
  const [locale, setCurrentLocale] = useState<UiLocale>(initialLocale);
  const [dictionary, setDictionary] = useState<Record<string, string>>(
    initialLocale === "en" ? UI_ENGLISH : {},
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadEnglish = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true);
    setError(null);
    setDictionary(UI_ENGLISH);
    try {
      const pageSize = 40;
      const firstPage = await api.get<TranslationPage>(
        `/i18n/en?offset=0&limit=${pageSize}`,
      );
      if (request === requestId.current)
        setDictionary((current) => ({
          ...current,
          ...firstPage.translations,
        }));
      const pageCount = Math.ceil(firstPage.total / pageSize);
      for (
        let firstPageIndex = 1;
        firstPageIndex < pageCount;
        firstPageIndex += 3
      ) {
        const pages = Array.from(
          { length: Math.min(3, pageCount - firstPageIndex) },
          (_, index) => firstPageIndex + index,
        );
        await Promise.all(
          pages.map(async (page) => {
            const result = await api.get<TranslationPage>(
              `/i18n/en?offset=${page * pageSize}&limit=${pageSize}`,
            );
            if (request === requestId.current)
              setDictionary((current) => ({
                ...current,
                ...result.translations,
              }));
          }),
        );
      }
    } catch (reason) {
      if (request === requestId.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Không thể tải bản dịch giao diện.",
        );
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, []);

  const setLocale = useCallback(
    async (nextLocale: UiLocale) => {
      requestId.current += 1;
      saveLocale(nextLocale);
      setCurrentLocale(nextLocale);
      document.documentElement.lang = nextLocale;
      setError(null);
      if (nextLocale === "vi") {
        setLoading(false);
        setDictionary({});
        return;
      }
      await loadEnglish();
    },
    [loadEnglish],
  );

  useEffect(() => {
    if (initialLocale !== "en") return;
    const timer = window.setTimeout(() => {
      void loadEnglish();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialLocale, loadEnglish]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      loading,
      error,
      t: (key) => dictionary[key] ?? UI_STRINGS[key],
      setLocale,
    }),
    [dictionary, error, loading, locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <LocalizedDom
        locale={locale}
        dictionary={dictionary}
        sourceStrings={UI_STRINGS}
        fallback={UI_ENGLISH}
      />
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}
