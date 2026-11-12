"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useFeedback } from "@/context/FeedbackContext";
import { useTasks } from "@/context/TaskContext";
import { reportWorkbook } from "@/lib/report-xlsx";
import { useLocale } from "@/i18n/locale-provider";
import "./programs.css";

const kinds = [
  ["sop", "SOP"],
  ["shift", "Lịch trực"],
  ["training", "Đào tạo"],
  ["inspection", "Kiểm tra"],
  ["okr", "OKR"],
  ["automation", "Quy tắc"],
  ["survey", "Khảo sát"],
] as const;
type Kind = (typeof kinds)[number][0];
type RecordItem = {
  id: number;
  kind: Kind;
  departmentId: number;
  ownerId: number | null;
  ownerName?: string;
  creatorName?: string;
  createdById: number;
  title: string;
  titleEn?: string | null;
  description?: string;
  descriptionEn?: string | null;
  status: string;
  version: number;
  acknowledgedVersion?: number | null;
  submittedResponseId?: number | null;
  responseCount?: number;
  payload: Record<string, unknown>;
};
type Person = {
  id: number;
  name: string;
  role: string;
  departmentId: number;
  isActive?: boolean;
};
type Department = { id: number; name: string };
type Capabilities = {
  enabled: boolean;
  automationExecution: boolean;
  shiftTaskGeneration: boolean;
  integrations: Record<string, boolean>;
  surveyResponsesIdentified: boolean;
};
type ShiftTask = {
  startsAt: string;
  endsAt: string;
  taskId: number;
  status: "active" | "cancelled";
  taskTitle: string;
  dueDate: string;
  taskStatus: string;
};
type AdvancedAlert = {
  id: number;
  recordId: number;
  alertType: string;
  message: string;
  readAt: string | null;
};
type RecordVersion = {
  version: number;
  snapshot: RecordItem;
  createdAt: string;
};
type SurveyResponse = {
  id: number;
  userId: number;
  name: string;
  answers: Record<string, unknown>;
  submittedAt: string;
};
type SopAcknowledgement = {
  recordId: number;
  version: number;
  users: Array<{
    userId: number;
    name: string;
    role: string;
    acknowledgedAt: string | null;
  }>;
};
type AutomationRun = {
  id: number;
  status: "success" | "failed";
  evaluatedTaskCount: number;
  notificationsCreated: number;
  errorCode: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

const statusNames: Record<string, string> = {
  draft: "Bản nháp",
  published: "Đang áp dụng",
  paused: "Tạm dừng",
  completed: "Hoàn thành",
  closed: "Đã đóng",
};
const taskStatusNames: Record<string, string> = {
  todo: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  done: "Hoàn thành",
  submitted: "Chờ duyệt",
};
const roleNames: Record<string, string> = {
  admin: "Quản trị",
  manager: "Trưởng khoa",
  leader: "Trưởng nhóm",
  staff: "Nhân viên",
};

const localInputTime = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const repeatLabels: Record<string, string> = {
  none: "Không lặp",
  daily: "Hằng ngày",
  weekly: "Hằng tuần",
  monthly: "Hằng tháng",
};
const shiftOccurrences = (payload: Record<string, unknown>) => {
  const startsAt = new Date(String(payload.startsAt ?? ""));
  const endsAt = new Date(String(payload.endsAt ?? ""));
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))
    return [];
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86400000);
  const repeat = String(payload.repeat ?? "none");
  if (repeat === "none")
    return endsAt >= now && startsAt <= horizon ? [{ startsAt, endsAt }] : [];
  const repeatUntil = new Date(`${String(payload.repeatUntil ?? "")}T23:59:59`);
  if (Number.isNaN(repeatUntil.getTime())) return [];
  const duration = endsAt.getTime() - startsAt.getTime();
  const anchorDay = startsAt.getDate();
  const cursor = new Date(startsAt);
  const occurrences: Array<{ startsAt: Date; endsAt: Date }> = [];
  for (
    let count = 0;
    count < 3660 && cursor <= repeatUntil && occurrences.length < 10;
    count += 1
  ) {
    if (cursor <= horizon && cursor.getTime() + duration >= now.getTime()) {
      occurrences.push({
        startsAt: new Date(cursor),
        endsAt: new Date(cursor.getTime() + duration),
      });
    }
    if (cursor > horizon && occurrences.length) break;
    if (repeat === "daily") cursor.setDate(cursor.getDate() + 1);
    else if (repeat === "weekly") cursor.setDate(cursor.getDate() + 7);
    else if (repeat === "monthly") {
      cursor.setDate(1);
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(
        Math.min(
          anchorDay,
          new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate(),
        ),
      );
    } else break;
  }
  return occurrences;
};
const integrationNames: Record<string, string> = {
  his: "HIS",
  sso: "SSO",
  sso_ldap: "SSO/LDAP",
  ldap: "LDAP",
  email: "Email",
  zalo: "Zalo",
  telegram: "Telegram",
  webhook: "Webhook",
  ai: "AI",
};
const trainingExpiryStatus = (value: string) => {
  const days = Math.ceil(
    (new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86400000,
  );
  if (!Number.isFinite(days))
    return { label: "Chưa có ngày hết hạn", tone: "neutral" };
  if (days < 0)
    return { label: `Đã quá hạn ${Math.abs(days)} ngày`, tone: "danger" };
  if (days <= 30)
    return { label: `Sắp hết hạn trong ${days} ngày`, tone: "warning" };
  return { label: "Còn hiệu lực", tone: "success" };
};

const inspectionRows = (record: RecordItem) => {
  const criteria = Array.isArray(record.payload.criteria)
    ? record.payload.criteria
    : [];
  const results = Array.isArray(record.payload.results)
    ? (record.payload.results as Array<{ score: number; note: string }>)
    : [];
  return criteria.map((_, index) => ({
    score: results[index] ? String(results[index].score) : "",
    note: results[index]?.note ?? "",
  }));
};
const surveyAnswerSummary = (
  responses: SurveyResponse[],
  questionId: string,
) => {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const answer = formatSurveyAnswer(response.answers[questionId]).trim();
    if (answer) counts.set(answer, (counts.get(answer) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([answer, count]) => ({
      answer,
      count,
      percent: total ? Math.round((count * 100) / total) : 0,
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.answer.localeCompare(right.answer, "vi"),
    );
};
const formatSurveyAnswer = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value))
    return value.map(formatSurveyAnswer).filter(Boolean).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
};

export default function ProgramsPage() {
  const user = getStoredUser();
  const { locale } = useLocale();
  const { runAction } = useFeedback();
  const { tasks } = useTasks();
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [kind, setKind] = useState<Kind>("sop");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [alerts, setAlerts] = useState<AdvancedAlert[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [capabilityRetry, setCapabilityRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [departmentId, setDepartmentId] = useState(
    String(user?.departmentId ?? ""),
  );
  const [ownerId, setOwnerId] = useState("");
  const [content, setContent] = useState("");
  const [contentEn, setContentEn] = useState("");
  const [shiftType, setShiftType] = useState("Ca ngày");
  const [shiftRepeat, setShiftRepeat] = useState("none");
  const [shiftRepeatUntil, setShiftRepeatUntil] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [relatedTaskId, setRelatedTaskId] = useState("");
  const [startsAt, setStartsAt] = useState(() => localInputTime(new Date()));
  const [endsAt, setEndsAt] = useState(() =>
    localInputTime(new Date(Date.now() + 8 * 3600000)),
  );
  const [expiresOn, setExpiresOn] = useState("");
  const [criteria, setCriteria] = useState("");
  const [quarter, setQuarter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
  });
  const [keyResults, setKeyResults] = useState("");
  const [threshold, setThreshold] = useState("2");
  const [questions, setQuestions] = useState("");
  const [answers, setAnswers] = useState<
    Record<number, Record<string, string>>
  >({});
  const [inspectionDrafts, setInspectionDrafts] = useState<
    Record<number, Array<{ score: string; note: string }>>
  >({});
  const [keyResultDrafts, setKeyResultDrafts] = useState<
    Record<number, Array<{ title: string; target: number; current: number }>>
  >({});
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [versions, setVersions] = useState<Record<number, RecordVersion[]>>({});
  const [sopAcknowledgements, setSopAcknowledgements] = useState<
    Record<number, SopAcknowledgement>
  >({});
  const [automationRuns, setAutomationRuns] = useState<
    Record<number, AutomationRun[]>
  >({});
  const [automationRunErrors, setAutomationRunErrors] = useState<
    Record<number, string>
  >({});
  const [shiftTasks, setShiftTasks] = useState<Record<number, ShiftTask[]>>({});
  const [shiftTaskErrors, setShiftTaskErrors] = useState<
    Record<number, string>
  >({});
  const [historyOpen, setHistoryOpen] = useState<number | null>(null);
  const [surveyResponses, setSurveyResponses] = useState<
    Record<number, SurveyResponse[]>
  >({});
  const [surveyResultsError, setSurveyResultsError] = useState("");
  const canManage = user?.role === "admin" || user?.role === "manager";
  const departmentChoices = useMemo(() => {
    if (user?.role === "admin") return departments;
    return departments.filter(
      (item) => Number(item.id) === Number(user?.departmentId),
    );
  }, [departments, user?.departmentId, user?.role]);

  const loadRecords = useCallback(
    async (selectedKind: Kind = kind) => {
      setLoading(true);
      try {
        const result = await api.get<RecordItem[]>(
          `/advanced-operations?kind=${selectedKind}`,
        );
        setRecords(result);
        setError("");
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Không tải được dữ liệu.",
        );
      } finally {
        setLoading(false);
      }
    },
    [kind],
  );

  useEffect(() => {
    let active = true;
    void api
      .get<Capabilities>("/advanced-operations/capabilities")
      .then(async (value) => {
        if (!active) return;
        setCapabilities(value);
        if (value.enabled) {
          const [units, staff, initialRecords, currentAlerts] =
            await Promise.all([
              api.get<Department[]>("/departments"),
              user?.role === "admin"
                ? api.get<Person[]>("/users")
                : api.get<Person[]>("/users/managed"),
              api.get<RecordItem[]>("/advanced-operations?kind=sop"),
              api.get<AdvancedAlert[]>("/advanced-operations/alerts"),
            ]);
          if (active) {
            setDepartments(units);
            setPeople(staff.filter((person) => person.isActive !== false));
            setRecords(initialRecords);
            setAlerts(currentAlerts);
            setLoading(false);
          }
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không kiểm tra được trạng thái.",
          );
      });
    return () => {
      active = false;
    };
  }, [user?.role, capabilityRetry]);

  const resetForm = () => {
    setEditingRecordId(null);
    setTitle("");
    setTitleEn("");
    setDescription("");
    setDescriptionEn("");
    setOwnerId("");
    setContent("");
    setContentEn("");
    setShiftRepeat("none");
    setShiftRepeatUntil("");
    setHandoverNotes("");
    setRelatedTaskId("");
    setCriteria("");
    setKeyResults("");
    setQuestions("");
    setFormOpen(false);
  };

  const buildPayload = () => {
    if (kind === "sop") return { content, contentEn: contentEn.trim() };
    if (kind === "shift")
      return {
        shiftType,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        repeat: shiftRepeat,
        ...(shiftRepeat !== "none" ? { repeatUntil: shiftRepeatUntil } : {}),
        handoverNotes: handoverNotes.trim(),
        ...(relatedTaskId ? { relatedTaskId: Number(relatedTaskId) } : {}),
      };
    if (kind === "training") return { expiresOn };
    if (kind === "inspection")
      return {
        criteria: criteria
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      };
    if (kind === "okr") {
      return {
        quarter,
        keyResults: keyResults.split("\n").map((line) => {
          const [resultTitle, target] = line.split("|");
          return { title: resultTitle?.trim() ?? "", target: Number(target) };
        }),
      };
    }
    if (kind === "automation")
      return {
        condition: { type: "overdue_task_count", threshold: Number(threshold) },
        action: { type: "notify_manager" },
      };
    return {
      questions: questions
        .split("\n")
        .map((prompt, index) => ({
          id: `q${index + 1}`,
          prompt: prompt.trim(),
        }))
        .filter((question) => question.prompt),
    };
  };

  async function createRecord(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (kind === "shift" && new Date(startsAt) >= new Date(endsAt)) {
      setError("Giờ kết thúc ca phải sau giờ bắt đầu.");
      return;
    }
    if (
      kind === "inspection" &&
      !criteria.split("\n").some((item) => item.trim())
    ) {
      setError("Nhập ít nhất một tiêu chí kiểm tra.");
      return;
    }
    if (kind === "okr") {
      const entries = keyResults.split("\n").filter((line) => line.trim());
      const invalid = entries.some((line) => {
        const [resultTitle, target] = line.split("|");
        return (
          !resultTitle?.trim() ||
          !Number.isFinite(Number(target)) ||
          Number(target) < 0
        );
      });
      if (!entries.length || invalid) {
        setError(
          "Mỗi kết quả then chốt cần có nội dung và chỉ tiêu số hợp lệ, theo mẫu: Nội dung | Chỉ tiêu.",
        );
        return;
      }
    }
    setError("");
    setBusy(true);
    const result = await runAction(
      () =>
        editingRecordId
          ? api.put(`/advanced-operations/${editingRecordId}`, {
              kind,
              departmentId: Number(departmentId),
              title: title.trim(),
              titleEn: titleEn.trim(),
              description: description.trim(),
              descriptionEn: descriptionEn.trim(),
              payload: buildPayload(),
            })
          : api.post("/advanced-operations", {
              kind,
              departmentId: Number(departmentId),
              ...(ownerId ? { ownerId: Number(ownerId) } : {}),
              title: title.trim(),
              titleEn: titleEn.trim(),
              description: description.trim(),
              descriptionEn: descriptionEn.trim(),
              payload: buildPayload(),
            }),
      { title: "Đã lưu hồ sơ", description: title.trim() },
    );
    setBusy(false);
    if (result.ok) {
      resetForm();
      await loadRecords();
    }
  }

  async function setStatus(record: RecordItem, status: string) {
    const result = await runAction(
      () =>
        api.patch<{ generatedTasks?: number }>(
          `/advanced-operations/${record.id}/status`,
          { status },
        ),
      (value) => ({
        title: `Đã cập nhật: ${statusNames[status] ?? status}`,
        description:
          record.kind === "shift" && capabilities?.shiftTaskGeneration
            ? value.generatedTasks
              ? `Đã tạo ${value.generatedTasks} công việc theo ca.`
              : "Không có ca mới trong phạm vi tạo công việc 30 ngày."
            : record.title,
      }),
    );
    if (result.ok) await loadRecords();
  }

  async function acknowledge(record: RecordItem) {
    const result = await runAction(
      () => api.post(`/advanced-operations/${record.id}/acknowledge`, {}),
      {
        title: "Đã xác nhận đã đọc SOP",
        description: `${record.title} · phiên bản ${record.version}`,
      },
    );
    if (result.ok) {
      await loadRecords();
      if (sopAcknowledgements[record.id]) await loadSopAcknowledgements(record);
    }
  }

  async function markAlertRead(alert: AdvancedAlert) {
    const result = await runAction(
      () => api.patch(`/advanced-operations/alerts/${alert.id}/read`, {}),
      { title: "Đã đánh dấu nhắc việc đã đọc" },
    );
    if (result.ok)
      setAlerts((current) =>
        current.map((item) =>
          item.id === alert.id
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
  }

  async function editSop(record: RecordItem) {
    setEditingRecordId(record.id);
    setTitle(record.title);
    setTitleEn(record.titleEn ?? "");
    setDescription(record.description ?? "");
    setDescriptionEn(record.descriptionEn ?? "");
    setDepartmentId(String(record.departmentId));
    setContent(String(record.payload.content ?? ""));
    setContentEn(String(record.payload.contentEn ?? ""));
    setFormOpen(true);
  }

  async function toggleHistory(record: RecordItem) {
    if (historyOpen === record.id) {
      setHistoryOpen(null);
      return;
    }
    if (!versions[record.id]) {
      const result = await runAction(
        () =>
          api.get<RecordVersion[]>(
            `/advanced-operations/${record.id}/versions`,
          ),
        { title: "Đã tải lịch sử phiên bản" },
      );
      if (!result.ok) return;
      setVersions((current) => ({ ...current, [record.id]: result.value }));
    }
    setHistoryOpen(record.id);
  }

  async function loadSopAcknowledgements(record: RecordItem) {
    const result = await runAction(
      () =>
        api.get<SopAcknowledgement>(
          `/advanced-operations/${record.id}/acknowledgements`,
        ),
      { title: "Đã tải trạng thái xác nhận SOP" },
    );
    if (result.ok)
      setSopAcknowledgements((current) => ({
        ...current,
        [record.id]: result.value,
      }));
  }

  async function loadAutomationRuns(record: RecordItem) {
    setAutomationRunErrors((current) => {
      const next = { ...current };
      delete next[record.id];
      return next;
    });
    const result = await runAction(
      () => api.get<AutomationRun[]>(`/advanced-operations/${record.id}/runs`),
      { title: "Đã tải lịch sử chạy quy tắc" },
    );
    if (result.ok)
      setAutomationRuns((current) => ({
        ...current,
        [record.id]: result.value,
      }));
    else
      setAutomationRunErrors((current) => ({
        ...current,
        [record.id]:
          "Không tải được lịch sử chạy. Chỉ người tạo quy tắc hoặc admin được xem.",
      }));
  }

  async function loadShiftTasks(record: RecordItem) {
    setShiftTaskErrors((current) => {
      const next = { ...current };
      delete next[record.id];
      return next;
    });
    const result = await runAction(
      () =>
        api.get<ShiftTask[]>(`/advanced-operations/${record.id}/shift-tasks`),
      { title: "Đã tải công việc theo ca" },
    );
    if (result.ok)
      setShiftTasks((current) => ({ ...current, [record.id]: result.value }));
    else
      setShiftTaskErrors((current) => ({
        ...current,
        [record.id]: "Không tải được danh sách công việc theo ca.",
      }));
  }

  async function submitSurvey(event: FormEvent, record: RecordItem) {
    event.preventDefault();
    const response = answers[record.id] ?? {};
    const result = await runAction(
      () =>
        api.post(`/advanced-operations/${record.id}/responses`, {
          answers: response,
        }),
      { title: "Đã gửi phản hồi khảo sát", description: record.title },
    );
    if (result.ok) setAnswers((current) => ({ ...current, [record.id]: {} }));
  }

  async function saveInspection(event: FormEvent, record: RecordItem) {
    event.preventDefault();
    const results = inspectionDrafts[record.id] ?? [];
    if (
      results.length !==
      (Array.isArray(record.payload.criteria)
        ? record.payload.criteria.length
        : 0)
    )
      return;
    const result = await runAction(
      () =>
        api.put(`/advanced-operations/${record.id}`, {
          kind: record.kind,
          departmentId: record.departmentId,
          ownerId: record.ownerId ?? undefined,
          title: record.title,
          description: record.description ?? "",
          status: record.status,
          payload: {
            ...record.payload,
            results: results.map((item) => ({
              score: Number(item.score),
              note: item.note.trim(),
            })),
          },
        }),
      { title: "Đã lưu kết quả kiểm tra", description: record.title },
    );
    if (result.ok) await loadRecords();
  }

  async function saveKeyResults(record: RecordItem) {
    const keyResults = keyResultDrafts[record.id];
    if (!keyResults?.length) return;
    const result = await runAction(
      () =>
        api.put(`/advanced-operations/${record.id}`, {
          kind: record.kind,
          departmentId: record.departmentId,
          ownerId: record.ownerId ?? undefined,
          title: record.title,
          description: record.description ?? "",
          status: record.status,
          payload: { ...record.payload, keyResults },
        }),
      { title: "Đã cập nhật tiến độ OKR", description: record.title },
    );
    if (result.ok) {
      setKeyResultDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      await loadRecords();
    }
  }

  async function loadSurveyResults(record: RecordItem) {
    setSurveyResultsError("");
    const result = await runAction(
      async () => {
        const response = await api.get<
          SurveyResponse[] | { items: SurveyResponse[] }
        >(`/advanced-operations/${record.id}/responses`);
        return Array.isArray(response) ? response : response.items;
      },
      { title: "Đã tải kết quả khảo sát" },
    );
    if (result.ok)
      setSurveyResponses((current) => ({
        ...current,
        [record.id]: result.value,
      }));
    else
      setSurveyResultsError(
        "Không tải được kết quả. Chỉ người tạo khảo sát hoặc admin được xem danh tính người trả lời.",
      );
  }

  const exportInspection = (record: RecordItem) => {
    const criteria = Array.isArray(record.payload.criteria)
      ? record.payload.criteria
      : [];
    const results = Array.isArray(record.payload.results)
      ? (record.payload.results as Array<{ score: number; note: string }>)
      : [];
    const rows: (string | number)[][] = [
      [
        "Khoa/phòng",
        departments.find((item) => item.id === record.departmentId)?.name ??
          String(record.departmentId),
      ],
      ["Người phụ trách", record.ownerName ?? "Chưa phân công"],
      [],
      ["STT", "Tiêu chí", "Điểm (0–5)", "Ghi chú / khắc phục"],
      ...criteria.map((criterion, index) => [
        index + 1,
        String(criterion),
        results[index]?.score ?? "",
        results[index]?.note ?? "Chưa ghi nhận",
      ]),
    ];
    const bytes = reportWorkbook(rows, {
      title: `BIÊN BẢN KIỂM TRA: ${record.title}`,
      period: new Date().toLocaleDateString("vi-VN"),
      author: user?.name ?? "",
    });
    const url = URL.createObjectURL(
      new Blob([bytes.buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bien-ban-kiem-tra-${record.id}.xlsx`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  function renderEditorFields() {
    if (kind === "sop")
      return (
        <>
          <label>
            {locale === "en" ? "SOP content" : "Nội dung SOP"}
            <textarea
              required
              minLength={10}
              maxLength={4000}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <label>
            {locale === "en" ? "SOP content in English (optional)" : "Nội dung SOP tiếng Anh (không bắt buộc)"}
            <textarea
              maxLength={4000}
              value={contentEn}
              onChange={(event) => setContentEn(event.target.value)}
            />
          </label>
        </>
      );
    if (kind === "shift")
      return (
        <>
          {capabilities?.shiftTaskGeneration ? (
            <p className="programs-warning">
              {locale === "en"
                ? "Publishing creates one task for the assigned employee for each shift in the next 30 days. No reviewer is assigned automatically."
                : "Khi phát hành, hệ thống tạo một công việc cho nhân viên phụ trách cho mỗi ca trong 30 ngày tới. Không tự gán người duyệt."}
            </p>
          ) : null}
          <label>
            {locale === "en" ? "Shift type" : "Loại ca"}
            <input
              required
              maxLength={80}
              value={shiftType}
              onChange={(event) => setShiftType(event.target.value)}
            />
          </label>
          <div className="programs-two-columns">
            <label>
              {locale === "en" ? "Starts" : "Bắt đầu"}
              <input
                required
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </label>
            <label>
              {locale === "en" ? "Ends" : "Kết thúc"}
              <input
                required
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </label>
          </div>
          <label>
            {locale === "en" ? "Repeat schedule" : "Lặp lịch"}
            <select
              value={shiftRepeat}
              onChange={(event) => setShiftRepeat(event.target.value)}
            >
              {Object.entries(repeatLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small>
              {locale === "en"
                ? "Recurring shifts are calculated from the start date; an end date is required. Each shift creates at most one task."
                : "Ca lặp được tính từ ngày bắt đầu; phải chọn ngày kết thúc. Mỗi lần trực tạo tối đa một công việc."}
            </small>
          </label>
          {shiftRepeat !== "none" ? (
            <label>
              {locale === "en" ? "Repeat until (inclusive)" : "Lặp đến (bao gồm ngày)"}
              <input
                type="date"
                required
                value={shiftRepeatUntil}
                onChange={(event) => setShiftRepeatUntil(event.target.value)}
              />
            </label>
          ) : null}
          <label>
            Tham chiếu công việc
            <select
              value={relatedTaskId}
              onChange={(event) => setRelatedTaskId(event.target.value)}
            >
              <option value="">Không liên kết</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <small>
              Liên kết công việc hiện có; trạng thái của việc liên kết không tự
              đồng bộ với lịch ca.
            </small>
          </label>
          <label>
            Ghi chú bàn giao
            <textarea
              maxLength={2000}
              value={handoverNotes}
              onChange={(event) => setHandoverNotes(event.target.value)}
            />
          </label>
        </>
      );
    if (kind === "training")
      return (
        <label>
          Ngày hết hạn chứng chỉ/đào tạo
          <input
            required
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
          />
        </label>
      );
    if (kind === "inspection")
      return (
        <label>
          Tiêu chí kiểm tra (mỗi dòng một tiêu chí)
          <textarea
            required
            value={criteria}
            onChange={(event) => setCriteria(event.target.value)}
          />
        </label>
      );
    if (kind === "okr")
      return (
        <>
          <label>
            Chu kỳ
            <input
              required
              pattern="20[0-9]{2}-Q[1-4]"
              placeholder="2026-Q4"
              value={quarter}
              onChange={(event) => setQuarter(event.target.value)}
            />
          </label>
          <label>
            Kết quả then chốt (mỗi dòng: nội dung | chỉ tiêu)
            <textarea
              required
              placeholder={"Giảm việc trễ hạn | 10\nHoàn thành đào tạo | 90"}
              value={keyResults}
              onChange={(event) => setKeyResults(event.target.value)}
            />
          </label>
        </>
      );
    if (kind === "automation")
      return (
        <label>
          Số công việc quá hạn đang mở để cảnh báo
          <input
            required
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
          <small>
            Quy tắc mới luôn ở trạng thái tạm dừng; chỉ chạy sau khi người quản
            lý phát hành.
          </small>
        </label>
      );
    return (
      <label>
        Câu hỏi (mỗi dòng một câu)
        <textarea
          required
          value={questions}
          onChange={(event) => setQuestions(event.target.value)}
        />
      </label>
    );
  }

  if (capabilities && !capabilities.enabled)
    return (
      <main className="programs-page">
        <header>
          <h1>Nghiệp vụ chuyên sâu</h1>
        </header>
        <section className="programs-notice">
          <h2>Chức năng hiện đang tắt</h2>
          <p>
            Liên hệ quản trị viên để kích hoạt chức năng.
          </p>
        </section>
      </main>
    );

  return (
    <main className="programs-page">
      <header className="programs-heading">
        <div>
          <h1>Nghiệp vụ chuyên sâu</h1>
        </div>
        {canManage && capabilities?.enabled ? (
          <button
            className="primary-action"
            type="button"
            onClick={() => setFormOpen((value) => !value)}
          >
            {formOpen ? "Đóng biểu mẫu" : "Tạo mới"}
          </button>
        ) : null}
      </header>
      {error ? (
        <div className="programs-error" role="alert">
          {error}
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              setError("");
              setLoading(true);
              setCapabilityRetry((value) => value + 1);
            }}
          >
            Thử lại
          </button>
        </div>
      ) : null}
      {alerts.some((alert) => !alert.readAt) ? (
        <section
          className="programs-alerts"
          aria-label="Nhắc đào tạo sắp hết hạn"
        >
          <h2>Nhắc đào tạo/chứng chỉ</h2>
          {alerts
            .filter((alert) => !alert.readAt)
            .map((alert) => (
              <div key={alert.id}>
                <p>{alert.message}</p>
                {user?.role !== "viewer" ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void markAlertRead(alert)}
                  >
                    Đã đọc
                  </button>
                ) : null}
              </div>
            ))}
        </section>
      ) : null}
      <nav className="programs-tabs" aria-label="Nhóm nghiệp vụ">
        {kinds.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={kind === value ? "is-selected" : ""}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              void loadRecords(value);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {kind === "automation" ? (
        <p className="programs-warning">
          {capabilities?.automationExecution
            ? "Quy tắc được chạy nội bộ mỗi 15 phút; thông báo chỉ gửi trong ứng dụng."
            : "Quy tắc chỉ được lưu và rà soát; chưa chạy hoặc gửi thông báo."}{" "}
        </p>
      ) : null}
      {kind === "survey" ? (
        <p className="programs-warning">
          Khảo sát có lưu danh tính; chỉ người tạo hoặc admin được xem danh sách
          người trả lời.
        </p>
      ) : null}
      {capabilities?.enabled && capabilities.integrations ? (
        <details
          className="programs-integrations"
          aria-label={locale === "en" ? "Integration status" : "Trạng thái tích hợp"}
        >
          <summary>{locale === "en" ? "External integrations" : "Tích hợp ngoài hệ thống"} <span>{locale === "en" ? "View connection status" : "Xem trạng thái kết nối"}</span></summary>
          <div className="programs-integration-items">
          {Object.entries(capabilities.integrations).map(
            ([key, configured]) => (
              <span key={key} className={configured ? "is-configured" : ""}>
                {integrationNames[key.toLowerCase()] ?? key}:{" "}
                {configured ? (locale === "en" ? "Configured" : "Đã cấu hình") : (locale === "en" ? "Not configured" : "Chưa cấu hình")}
              </span>
            ),
          )}
          </div>
          {!capabilities.automationExecution ? (
            <p className="programs-footnote">{locale === "en" ? "Automation rules are disabled." : "Quy tắc tự động đang tắt."}</p>
          ) : null}
        </details>
      ) : null}
      {formOpen && canManage ? (
        <form
          className="programs-form"
          onSubmit={(event) => void createRecord(event)}
        >
          <h2>
            {editingRecordId
              ? (locale === "en" ? "Create new SOP version" : "Tạo phiên bản SOP mới")
              : `${kinds.find(([value]) => value === kind)?.[1]} ${locale === "en" ? "new" : "mới"}`}
          </h2>
          <div className="programs-two-columns">
            <label>
              {locale === "en" ? "Title" : "Tiêu đề"}
              <input
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              {locale === "en" ? "English title (optional)" : "Tiêu đề tiếng Anh (không bắt buộc)"}
              <input
                maxLength={200}
                value={titleEn}
                onChange={(event) => setTitleEn(event.target.value)}
              />
            </label>
            <label>
              {locale === "en" ? "Department" : "Khoa/phòng"}
              <select
                required
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
              >
                {user?.role === "admin" ? (
                  <option value="">{locale === "en" ? "Select a department" : "Chọn khoa/phòng"}</option>
                ) : null}
                {departmentChoices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {["shift", "training", "inspection"].includes(kind) ? (
              <label>
                {kind === "inspection" ? (locale === "en" ? "Assignee" : "Người phụ trách") : (locale === "en" ? "Employee" : "Nhân viên")}
                <select
                  required
                  value={ownerId}
                  onChange={(event) => setOwnerId(event.target.value)}
                >
                  <option value="">{locale === "en" ? "Select an employee" : "Chọn nhân viên"}</option>
                  {people
                    .filter(
                      (person) =>
                        Number(person.departmentId) === Number(departmentId),
                    )
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <label>
              {locale === "en" ? "Description" : "Mô tả"}
              <textarea
                maxLength={4000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label>
              {locale === "en" ? "English description (optional)" : "Mô tả tiếng Anh (không bắt buộc)"}
              <textarea
                maxLength={4000}
                value={descriptionEn}
                onChange={(event) => setDescriptionEn(event.target.value)}
              />
            </label>
          </div>
          {renderEditorFields()}
          <button className="primary-action" disabled={busy}>
            {busy ? (locale === "en" ? "Saving…" : "Đang lưu…") : (locale === "en" ? "Save draft" : "Lưu bản nháp")}
          </button>
        </form>
      ) : null}
      {loading ? (
        <p className="programs-empty" role="status">{locale === "en" ? "Loading records…" : "Đang tải hồ sơ…"}</p>
      ) : records.length === 0 ? (
        <section className="programs-empty">
          <span className="programs-empty-icon" aria-hidden="true">▤</span>
          <h2>{locale === "en" ? `No ${kind} records yet` : `Chưa có hồ sơ ${kinds.find(([value]) => value === kind)?.[1]}`}</h2>
          <p>{locale === "en" ? "Records in this category will appear here for tracking and management." : "Hồ sơ trong nhóm này sẽ được hiển thị tại đây để theo dõi và quản lý."}</p>
          {canManage && capabilities?.enabled && !formOpen ? (
            <button type="button" className="primary-action" onClick={() => setFormOpen(true)}>{locale === "en" ? "Create the first record" : "Tạo hồ sơ đầu tiên"}</button>
          ) : null}
        </section>
      ) : (
        <section className="programs-list">
          {records.map((record) => {
            const payload = record.payload ?? {};
            const isCreator = record.createdById === user?.id;
            const displayTitle =
              locale === "en" && record.titleEn?.trim()
                ? record.titleEn
                : record.title;
            const displayDescription =
              locale === "en" && record.descriptionEn?.trim()
                ? record.descriptionEn
                : record.description;
            const displaySopContent =
              locale === "en" &&
              typeof payload.contentEn === "string" &&
              payload.contentEn.trim()
                ? payload.contentEn
                : payload.content;
            return (
              <article className="programs-card" key={record.id}>
                <header>
                  <div>
                    <span className={`programs-status status-${record.status}`}>
                      {statusNames[record.status] ?? record.status}
                    </span>
                    <h2 data-i18n-skip>{displayTitle}</h2>
                  </div>
                  <span className="programs-version">v{record.version}</span>
                </header>
                {displayDescription ? <p data-i18n-skip>{displayDescription}</p> : null}
                {kind === "sop" ? (
                  <>
                    <div className="programs-content" data-i18n-skip>
                      {String(displaySopContent ?? "")}
                    </div>
                    {record.status === "published" &&
                    user?.role !== "viewer" ? (
                      record.acknowledgedVersion === record.version ? (
                        <p role="status">Bạn đã xác nhận đọc phiên bản này.</p>
                      ) : (
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void acknowledge(record)}
                        >
                          Xác nhận đã đọc phiên bản {record.version}
                        </button>
                      )
                    ) : null}
                    {canManage && (isCreator || user?.role === "admin") ? (
                      <div className="programs-card-actions">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void editSop(record)}
                        >
                          Tạo phiên bản mới
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void toggleHistory(record)}
                        >
                          Lịch sử phiên bản
                        </button>
                        {record.status === "published" ? (
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => void loadSopAcknowledgements(record)}
                          >
                            Trạng thái xác nhận
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {historyOpen === record.id ? (
                      <div className="programs-history">
                        {(versions[record.id] ?? []).map((version) => (
                          <details key={version.version}>
                            <summary>
                              Phiên bản {version.version} ·{" "}
                              {new Date(version.createdAt).toLocaleString(
                                "vi-VN",
                              )}
                            </summary>
                            <div className="programs-content">
                              {String(
                                locale === "en" &&
                                  typeof version.snapshot.payload?.contentEn === "string" &&
                                  version.snapshot.payload.contentEn.trim()
                                  ? version.snapshot.payload.contentEn
                                  : version.snapshot.payload?.content ?? "",
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : null}
                    {sopAcknowledgements[record.id] ? (
                      <section
                        className="programs-sop-acknowledgements"
                        aria-label="Trạng thái xác nhận đã đọc SOP"
                      >
                        <h3>
                          Phiên bản {sopAcknowledgements[record.id].version} ·{" "}
                          {
                            sopAcknowledgements[record.id].users.filter(
                              (person) => !person.acknowledgedAt,
                            ).length
                          }{" "}
                          người chưa xác nhận
                        </h3>
                        {sopAcknowledgements[record.id].users.length ? (
                          <ul>
                            {sopAcknowledgements[record.id].users.map(
                              (person) => (
                                <li key={person.userId}>
                                  {person.name} ·{" "}
                                  {roleNames[person.role] ?? "Tài khoản"} ·{" "}
                                  {person.acknowledgedAt
                                    ? `Đã xác nhận ${new Date(person.acknowledgedAt).toLocaleString("vi-VN")}`
                                    : "Chưa xác nhận"}
                                </li>
                              ),
                            )}
                          </ul>
                        ) : (
                          <p>
                            Không có nhân sự đang hoạt động trong khoa/phòng.
                          </p>
                        )}
                      </section>
                    ) : null}
                  </>
                ) : null}
                {kind === "shift" ? (
                  <>
                    <p>
                      {String(payload.shiftType ?? "")} ·{" "}
                      {record.ownerName ?? "Chưa phân công"}
                    </p>
                    <p>
                      Lịch:{" "}
                      {repeatLabels[String(payload.repeat ?? "none")] ??
                        "Không lặp"}
                      {payload.repeatUntil
                        ? ` đến ${String(payload.repeatUntil)}`
                        : ""}
                      {payload.relatedTaskId
                        ? ` · Liên kết công việc ${tasks.find((task) => Number(task.id) === Number(payload.relatedTaskId))?.title ?? `#${payload.relatedTaskId}`}`
                        : ""}
                    </p>
                    {(() => {
                      const occurrences = shiftOccurrences(payload);
                      return occurrences.length ? (
                        <div className="programs-shift-occurrences">
                          <strong>Các ca dự kiến trong 30 ngày tới</strong>
                          <ul>
                            {occurrences.map((occurrence) => (
                              <li key={occurrence.startsAt.toISOString()}>
                                {occurrence.startsAt.toLocaleString("vi-VN")} –{" "}
                                {occurrence.endsAt.toLocaleString("vi-VN")}
                              </li>
                            ))}
                          </ul>
                          <small>
                            Danh sách này là lịch dự kiến, không thay thế trạng
                            thái công việc đã tạo.
                          </small>
                        </div>
                      ) : (
                        <p>Không có ca trong 30 ngày tới.</p>
                      );
                    })()}
                    {payload.handoverNotes ? (
                      <div className="programs-content">
                        <strong>Bàn giao:</strong>{" "}
                        {String(payload.handoverNotes)}
                      </div>
                    ) : null}
                    {canManage &&
                    capabilities?.shiftTaskGeneration &&
                    record.status === "published" ? (
                      <>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void loadShiftTasks(record)}
                        >
                          Công việc đã tạo
                        </button>
                        {shiftTaskErrors[record.id] ? (
                          <p role="alert" className="programs-error">
                            {shiftTaskErrors[record.id]}
                          </p>
                        ) : null}
                        {shiftTasks[record.id] ? (
                          <section
                            className="programs-automation-history"
                            aria-label="Công việc được tạo từ lịch trực"
                          >
                            <h3>Công việc theo ca</h3>
                            {shiftTasks[record.id].length ? (
                              <ul>
                                {shiftTasks[record.id].map((item) => (
                                  <li key={item.taskId}>
                                    <strong>{item.taskTitle}</strong> ·{" "}
                                    {new Date(item.startsAt).toLocaleString(
                                      "vi-VN",
                                    )}{" "}
                                    –{" "}
                                    {new Date(item.endsAt).toLocaleString(
                                      "vi-VN",
                                    )}{" "}
                                    · Hạn {item.dueDate} ·{" "}
                                    {item.status === "cancelled"
                                      ? "Đã hủy do lịch thay đổi"
                                      : (taskStatusNames[item.taskStatus] ??
                                        item.taskStatus)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>Chưa có công việc sinh cho lịch này.</p>
                            )}
                          </section>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {kind === "training"
                  ? (() => {
                      const expiry = String(payload.expiresOn ?? "");
                      const state = expiry
                        ? trainingExpiryStatus(expiry)
                        : trainingExpiryStatus("");
                      return (
                        <p>
                          {record.ownerName ?? "Nhân viên"} · Hết hạn:{" "}
                          {expiry || "Chưa có ngày"} ·{" "}
                          <span
                            className={`programs-expiry programs-expiry-${state.tone}`}
                          >
                            {state.label}
                          </span>
                        </p>
                      );
                    })()
                  : null}
                {kind === "inspection" ? (
                  <>
                    <p>Phụ trách: {record.ownerName ?? "Chưa phân công"}</p>
                    {(() => {
                      const criteriaCount = Array.isArray(payload.criteria)
                        ? payload.criteria.length
                        : 0;
                      const resultCount = Array.isArray(payload.results)
                        ? payload.results.length
                        : 0;
                      const progress = criteriaCount
                        ? Math.round((resultCount * 100) / criteriaCount)
                        : 0;
                      return (
                        <div className="programs-progress">
                          <span>
                            Tiến độ kiểm tra: {resultCount}/{criteriaCount} tiêu
                            chí ({progress}%)
                          </span>
                          <progress
                            max={100}
                            value={progress}
                            aria-label={`Tiến độ kiểm tra ${record.title}`}
                          />
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => window.print()}
                    >
                      In / lưu PDF
                    </button>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => exportInspection(record)}
                    >
                      Xuất biên bản Excel
                    </button>
                    <ul>
                      {(Array.isArray(payload.criteria)
                        ? payload.criteria
                        : []
                      ).map((item, index) => (
                        <li key={index}>{String(item)}</li>
                      ))}
                    </ul>
                    {canManage && (isCreator || user?.role === "admin") ? (
                      <form
                        className="programs-response"
                        onSubmit={(event) => void saveInspection(event, record)}
                      >
                        {(Array.isArray(payload.criteria)
                          ? payload.criteria
                          : []
                        ).map((item, index) => (
                          <div className="programs-inspection-row" key={index}>
                            <strong>{String(item)}</strong>
                            <label>
                              Điểm (0–5)
                              <select
                                required
                                value={
                                  inspectionDrafts[record.id]?.[index]?.score ??
                                  inspectionRows(record)[index]?.score ??
                                  ""
                                }
                                onChange={(event) =>
                                  setInspectionDrafts((current) => {
                                    const next = [
                                      ...(current[record.id] ??
                                        inspectionRows(record)),
                                    ];
                                    next[index] = {
                                      score: event.target.value,
                                      note: next[index]?.note ?? "",
                                    };
                                    return { ...current, [record.id]: next };
                                  })
                                }
                              >
                                <option value="">Chọn điểm</option>
                                {[0, 1, 2, 3, 4, 5].map((score) => (
                                  <option key={score} value={score}>
                                    {score}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Ghi chú/khắc phục
                              <textarea
                                required
                                minLength={3}
                                maxLength={1000}
                                value={
                                  inspectionDrafts[record.id]?.[index]?.note ??
                                  inspectionRows(record)[index]?.note ??
                                  ""
                                }
                                onChange={(event) =>
                                  setInspectionDrafts((current) => {
                                    const next = [
                                      ...(current[record.id] ??
                                        inspectionRows(record)),
                                    ];
                                    next[index] = {
                                      score: next[index]?.score ?? "",
                                      note: event.target.value,
                                    };
                                    return { ...current, [record.id]: next };
                                  })
                                }
                              />
                            </label>
                          </div>
                        ))}
                        <button className="secondary-action">
                          Lưu điểm & khắc phục
                        </button>
                      </form>
                    ) : Array.isArray(payload.results) ? (
                      <ul>
                        {(
                          payload.results as Array<{
                            score: number;
                            note: string;
                          }>
                        ).map((result, index) => (
                          <li key={index}>
                            Điểm {result.score}/5 · {result.note}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}
                {kind === "okr" ? (
                  <>
                    <p>Chu kỳ {String(payload.quarter ?? "")}</p>
                    <ul>
                      {(Array.isArray(payload.keyResults)
                        ? (payload.keyResults as Array<{
                            title: string;
                            target: number;
                            current?: number;
                          }>)
                        : []
                      ).map((item, index) => {
                        const progress =
                          item.target > 0
                            ? Math.max(
                                0,
                                Math.min(
                                  100,
                                  Math.round(
                                    (Number(item.current ?? 0) * 100) /
                                      item.target,
                                  ),
                                ),
                              )
                            : 0;
                        const editable =
                          canManage &&
                          (isCreator ||
                            user?.role === "admin" ||
                            record.ownerId === user?.id);
                        return (
                          <li key={index} className="programs-okr-result">
                            <div>
                              <strong>{item.title}</strong>
                              <span>
                                {Number(item.current ?? 0)} / {item.target} ·{" "}
                                {progress}%
                              </span>
                              <progress
                                max={100}
                                value={progress}
                                aria-label={`Tiến độ ${item.title}`}
                              />
                            </div>
                            {editable ? (
                              <label>
                                Tiến độ hiện tại
                                <input
                                  type="number"
                                  min={0}
                                  value={
                                    keyResultDrafts[record.id]?.[index]
                                      ?.current ??
                                    item.current ??
                                    0
                                  }
                                  onChange={(event) =>
                                    setKeyResultDrafts((current) => {
                                      const list = [
                                        ...(current[record.id] ??
                                          (
                                            payload.keyResults as Array<{
                                              title: string;
                                              target: number;
                                              current?: number;
                                            }>
                                          ).map((result) => ({
                                            ...result,
                                            current: Number(
                                              result.current ?? 0,
                                            ),
                                          }))),
                                      ];
                                      list[index] = {
                                        ...list[index],
                                        current: Number(event.target.value),
                                      };
                                      return { ...current, [record.id]: list };
                                    })
                                  }
                                />
                              </label>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    {canManage &&
                    (isCreator ||
                      user?.role === "admin" ||
                      record.ownerId === user?.id) ? (
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void saveKeyResults(record)}
                      >
                        Lưu tiến độ OKR
                      </button>
                    ) : null}
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void toggleHistory(record)}
                        >
                          Lịch sử cập nhật
                        </button>
                        {historyOpen === record.id ? (
                          <div className="programs-history">
                            {(versions[record.id] ?? []).map((version) => (
                              <details key={version.version}>
                                <summary>
                                  Phiên bản {version.version} ·{" "}
                                  {new Date(version.createdAt).toLocaleString(
                                    "vi-VN",
                                  )}
                                </summary>
                                <pre>
                                  {JSON.stringify(
                                    version.snapshot.payload.keyResults ?? [],
                                    null,
                                    2,
                                  )}
                                </pre>
                              </details>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {kind === "automation" ? (
                  <>
                    <p>
                      Khi có ít nhất{" "}
                      {String(
                        (payload.condition as { threshold?: unknown })
                          ?.threshold ?? "?",
                      )}{" "}
                      công việc quá hạn đang mở → thông báo trưởng khoa trong
                      ứng dụng.
                    </p>
                    {capabilities?.automationExecution ? (
                      <p role="status">
                        Quy tắc được thực thi nội bộ; không gửi thông báo ra
                        ngoài.
                      </p>
                    ) : (
                      <p className="programs-warning">
                        Thực thi đang tắt; quy tắc chỉ được lưu và rà soát.
                      </p>
                    )}
                    {canManage && (isCreator || user?.role === "admin") ? (
                      <>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void loadAutomationRuns(record)}
                        >
                          Lịch sử chạy
                        </button>
                        {automationRunErrors[record.id] ? (
                          <p role="alert" className="programs-error">
                            {automationRunErrors[record.id]}
                          </p>
                        ) : null}
                        {automationRuns[record.id] ? (
                          <section className="programs-automation-history">
                            <h3>Lịch sử 100 lần chạy gần nhất</h3>
                            {automationRuns[record.id].length ? (
                              <ul>
                                {automationRuns[record.id].map((run) => (
                                  <li key={run.id}>
                                    <strong>
                                      {run.status === "success"
                                        ? "Thành công"
                                        : "Thất bại"}
                                    </strong>{" "}
                                    ·{" "}
                                    {new Date(run.startedAt).toLocaleString(
                                      "vi-VN",
                                    )}{" "}
                                    · Đã đánh giá {run.evaluatedTaskCount} việc
                                    · Tạo {run.notificationsCreated} thông báo
                                    {run.errorCode
                                      ? ` · Mã lỗi ${run.errorCode}`
                                      : ""}{" "}
                                    · {run.durationMs} ms
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p>Chưa có lần chạy nào được ghi nhận.</p>
                            )}
                          </section>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {kind === "survey" ? (
                  <>
                    <p>
                      {Array.isArray(payload.questions)
                        ? payload.questions.length
                        : 0}{" "}
                      câu hỏi
                    </p>
                    {record.submittedResponseId ? (
                      <p role="status">Bạn đã gửi câu trả lời.</p>
                    ) : record.status === "published" &&
                      user?.role !== "viewer" ? (
                      <form
                        className="programs-response"
                        onSubmit={(event) => void submitSurvey(event, record)}
                      >
                        {(Array.isArray(payload.questions)
                          ? (payload.questions as Array<{
                              id: string;
                              prompt: string;
                            }>)
                          : []
                        ).map((question) => (
                          <label key={question.id}>
                            {question.prompt}
                            <input
                              required
                              maxLength={2000}
                              value={answers[record.id]?.[question.id] ?? ""}
                              onChange={(event) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [record.id]: {
                                    ...current[record.id],
                                    [question.id]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        ))}
                        <button className="secondary-action">
                          Gửi khảo sát
                        </button>
                      </form>
                    ) : null}
                    {canManage && (isCreator || user?.role === "admin") ? (
                      <>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void loadSurveyResults(record)}
                        >
                          Tổng hợp kết quả
                        </button>
                        {surveyResultsError ? (
                          <p role="alert" className="programs-error">
                            {surveyResultsError}
                          </p>
                        ) : null}
                        {surveyResponses[record.id] ? (
                          <section className="programs-survey-results">
                            <h3>Kết quả có danh tính</h3>
                            <p>
                              {surveyResponses[record.id].length} lượt trả lời
                            </p>
                            {(Array.isArray(payload.questions)
                              ? (payload.questions as Array<{
                                  id: string;
                                  prompt: string;
                                }>)
                              : []
                            ).map((question) => (
                              <div
                                className="programs-survey-question"
                                key={question.id}
                              >
                                <strong>{question.prompt}</strong>
                                {surveyAnswerSummary(
                                  surveyResponses[record.id],
                                  question.id,
                                ).map((answer) => (
                                  <div
                                    className="programs-survey-answer"
                                    key={answer.answer}
                                  >
                                    <span>
                                      {answer.answer} · {answer.count}
                                    </span>
                                    <div
                                      role="progressbar"
                                      aria-label={`${answer.percent}% chọn ${answer.answer}`}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                      aria-valuenow={answer.percent}
                                    >
                                      <span
                                        style={{ width: `${answer.percent}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {surveyResponses[record.id].map((response) => (
                              <details key={response.id}>
                                <summary>
                                  {response.name} ·{" "}
                                  {new Date(
                                    response.submittedAt,
                                  ).toLocaleString("vi-VN")}
                                </summary>
                                <dl>
                                  {Object.entries(response.answers).map(
                                    ([questionId, answer]) => (
                                      <div key={questionId}>
                                        <dt>
                                          {(
                                            payload.questions as
                                              | Array<{
                                                  id: string;
                                                  prompt: string;
                                                }>
                                              | undefined
                                          )?.find(
                                            (question) =>
                                              question.id === questionId,
                                          )?.prompt ?? questionId}
                                        </dt>
                                        <dd>{formatSurveyAnswer(answer)}</dd>
                                      </div>
                                    ),
                                  )}
                                </dl>
                              </details>
                            ))}
                          </section>
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : null}
                {canManage && (isCreator || user?.role === "admin") ? (
                  <footer>
                    {record.status === "draft" ? (
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void setStatus(record, "published")}
                      >
                        Phát hành
                      </button>
                    ) : null}
                    {record.status === "paused" && kind === "automation" ? (
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void setStatus(record, "published")}
                      >
                        Bật quy tắc
                      </button>
                    ) : null}
                    {record.status === "published" && kind === "automation" ? (
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void setStatus(record, "paused")}
                      >
                        Tạm dừng quy tắc
                      </button>
                    ) : null}
                    {record.status === "published" && kind === "survey" ? (
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void setStatus(record, "closed")}
                      >
                        Đóng khảo sát
                      </button>
                    ) : null}
                    {["shift", "training", "inspection", "okr"].includes(
                      kind,
                    ) && record.status === "published" ? (
                      <button
                        type="button"
                        className="secondary-action"
                        onClick={() => void setStatus(record, "completed")}
                      >
                        Đánh dấu hoàn thành
                      </button>
                    ) : null}
                  </footer>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
