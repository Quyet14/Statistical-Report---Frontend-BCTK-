"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useFeedback } from "@/context/FeedbackContext";
import { useTasks } from "@/context/TaskContext";

type Department = { id: number; name: string };
type Person = { id: number; name: string; role: string; departmentId: number };
type DepartmentRequest = {
  id: number;
  sourceDepartmentId: number;
  sourceDepartmentName: string;
  targetDepartmentId: number;
  targetDepartmentName: string;
  requesterId: number;
  requesterName: string;
  assigneeId: number;
  assigneeName: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: string;
  status: string;
};
type Incident = {
  id: number;
  taskId: number;
  checklistItemId: number;
  departmentId: number;
  departmentName: string;
  reporterId: number;
  reporterName: string;
  assigneeId: number;
  assigneeName: string;
  title: string;
  description?: string;
  severity: string;
  dueDate: string;
  status: string;
  resolutionNote?: string;
};
type Equipment = {
  id: number;
  departmentId: number;
  departmentName: string;
  assigneeId: number;
  assigneeName: string;
  assetCode: string;
  name: string;
  location?: string;
  qrCode: string;
  checklist: string[];
  inspectionCadence: string;
  nextInspectionDate: string;
  maintenanceCadence: string;
  nextMaintenanceDate?: string | null;
  active: boolean;
};
type PageResult<T> = { items: T[]; total: number };
type Tab = "requests" | "incidents" | "equipment";

const dateToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const labels: Record<string, string> = {
  pending: "Chờ tiếp nhận",
  accepted: "Đã tiếp nhận",
  in_progress: "Đang xử lý",
  completed: "Hoàn thành",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
  open: "Mới báo",
  resolved: "Đã khắc phục",
  closed: "Đã đóng",
};
const cadenceLabel = (value: string) =>
  ({
    daily: "Hằng ngày",
    weekly: "Hằng tuần",
    monthly: "Hằng tháng",
    none: "Không định kỳ",
  })[value] ?? value;

export default function HospitalOperationsPage() {
  return (
    <Suspense fallback={<div className="panel-card hospital-disabled">Đang mở nghiệp vụ bệnh viện…</div>}>
      <HospitalOperationsContent />
    </Suspense>
  );
}

function HospitalOperationsContent() {
  const searchParams = useSearchParams();
  const initialTaskId = searchParams.get("taskId") ?? "";
  const initialChecklistId = searchParams.get("itemId") ?? "";
  const user = getStoredUser();
  const { tasks } = useTasks();
  const { runAction } = useFeedback();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>(
    initialTaskId && initialChecklistId ? "incidents" : "requests",
  );
  const [departments, setDepartments] = useState<Department[]>([]);
  const [recipients, setRecipients] = useState<Person[]>([]);
  const [requests, setRequests] = useState<DepartmentRequest[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [targetDepartmentId, setTargetDepartmentId] = useState("");
  const [sourceDepartmentId, setSourceDepartmentId] = useState(
    String(user?.departmentId ?? ""),
  );
  const [selectedTaskId, setSelectedTaskId] = useState(initialTaskId);
  const [selectedChecklistId, setSelectedChecklistId] =
    useState(initialChecklistId);
  const [equipmentDepartmentId, setEquipmentDepartmentId] = useState(
    String(user?.departmentId ?? ""),
  );
  const [inspectionEquipment, setInspectionEquipment] = useState<number | null>(
    null,
  );
  const [inspectionResults, setInspectionResults] = useState<
    Record<number, boolean | undefined>
  >({});
  const [editingEquipmentId, setEditingEquipmentId] = useState<number | null>(
    null,
  );
  const [requestForm, setRequestForm] = useState({
    assigneeId: "",
    title: "",
    description: "",
    dueDate: dateToday(),
    priority: "medium",
  });
  const [incidentForm, setIncidentForm] = useState({
    assigneeId: "",
    title: "",
    description: "",
    severity: "medium",
    dueDate: dateToday(),
  });
  const [equipmentForm, setEquipmentForm] = useState({
    departmentId: String(user?.departmentId ?? ""),
    assigneeId: "",
    assetCode: "",
    name: "",
    location: "",
    checklist: "",
    inspectionCadence: "daily",
    nextInspectionDate: dateToday(),
    maintenanceCadence: "monthly",
    nextMaintenanceDate: dateToday(),
  });
  const manageEquipment = user?.role === "admin" || user?.role === "manager";
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const selectedChecklist = selectedTask?.checklist?.find(
    (item) => String(item.id) === selectedChecklistId,
  );
  const equipmentPeople = useMemo(
    () =>
      recipients.filter(
        (person) => String(person.departmentId) === equipmentDepartmentId,
      ),
    [recipients, equipmentDepartmentId],
  );

  useEffect(() => {
    let active = true;
    void api
      .get<{ enabled: boolean }>("/hospital-operations/capabilities")
      .then(async (value) => {
        if (!active) return;
        setEnabled(value.enabled);
        if (value.enabled) {
          const units = await api.get<Department[]>(
            "/hospital-operations/departments",
          );
          if (active) setDepartments(units);
        }
      })
      .catch((reason) => {
        if (active) {
          setEnabled(null);
          setError(
            reason instanceof Error
              ? reason.message
              : "Không kiểm tra được tính năng.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const endpoint =
      tab === "requests"
        ? "/hospital-operations/requests"
        : tab === "incidents"
          ? "/hospital-operations/incidents"
          : "/hospital-operations/equipment";
    void api
      .get<PageResult<DepartmentRequest | Incident | Equipment>>(endpoint)
      .then((result) => {
        if (!active) return;
        if (tab === "requests")
          setRequests(result.items as DepartmentRequest[]);
        if (tab === "incidents") setIncidents(result.items as Incident[]);
        if (tab === "equipment") setEquipment(result.items as Equipment[]);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được dữ liệu.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, tab, refresh]);

  useEffect(() => {
    if (!enabled || !targetDepartmentId) {
      return;
    }
    void api
      .get<Person[]>(
        `/hospital-operations/recipients?departmentId=${targetDepartmentId}`,
      )
      .then(setRecipients)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Không tải được người nhận.",
        ),
      );
  }, [enabled, targetDepartmentId]);

  useEffect(() => {
    if (!enabled || !equipmentDepartmentId || tab !== "equipment") return;
    void api
      .get<Person[]>(
        `/hospital-operations/recipients?departmentId=${equipmentDepartmentId}`,
      )
      .then(setRecipients)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Không tải được người phụ trách.",
        ),
      );
  }, [enabled, equipmentDepartmentId, tab]);

  useEffect(() => {
    if (!enabled || !selectedTask?.departmentId || tab !== "incidents") return;
    void api
      .get<Person[]>(
        `/hospital-operations/recipients?departmentId=${selectedTask.departmentId}`,
      )
      .then(setRecipients)
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Không tải được người xử lý.",
        ),
      );
  }, [enabled, selectedTask?.departmentId, tab]);

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    const result = await runAction(
      () =>
        api.post("/hospital-operations/requests", {
          ...(user?.role === "admin"
            ? { sourceDepartmentId: Number(sourceDepartmentId) }
            : {}),
          targetDepartmentId: Number(targetDepartmentId),
          assigneeId: Number(requestForm.assigneeId),
          title: requestForm.title.trim(),
          description: requestForm.description.trim(),
          dueDate: requestForm.dueDate,
          priority: requestForm.priority,
        }),
      { title: "Đã gửi yêu cầu liên khoa", description: requestForm.title },
    );
    if (result.ok) {
      setRequestForm({
        assigneeId: "",
        title: "",
        description: "",
        dueDate: dateToday(),
        priority: "medium",
      });
      setRefresh((value) => value + 1);
    }
  }

  async function changeRequest(item: DepartmentRequest, status: string) {
    const result = await runAction(
      () =>
        api.patch(`/hospital-operations/requests/${item.id}/status`, {
          status,
        }),
      {
        title: `Yêu cầu: ${labels[status] ?? status}`,
        description: item.title,
      },
    );
    if (result.ok) setRefresh((value) => value + 1);
  }

  async function submitIncident(event: FormEvent) {
    event.preventDefault();
    if (!selectedTask || !selectedChecklist) return;
    const result = await runAction(
      () =>
        api.post("/hospital-operations/incidents/from-checklist", {
          taskId: Number(selectedTask.id),
          checklistItemId: selectedChecklist.id,
          assigneeId: Number(incidentForm.assigneeId),
          title: incidentForm.title.trim(),
          description: incidentForm.description.trim(),
          severity: incidentForm.severity,
          dueDate: incidentForm.dueDate,
        }),
      { title: "Đã tạo phiếu sự cố", description: incidentForm.title },
    );
    if (result.ok) {
      setIncidentForm({
        assigneeId: "",
        title: "",
        description: "",
        severity: "medium",
        dueDate: dateToday(),
      });
      setSelectedChecklistId("");
      setRefresh((value) => value + 1);
    }
  }

  async function changeIncident(item: Incident, status: string) {
    const resolutionNote =
      status === "resolved"
        ? window.prompt("Ghi cách khắc phục (bắt buộc):", "")
        : undefined;
    if (status === "resolved" && !resolutionNote?.trim()) return;
    const result = await runAction(
      () =>
        api.patch(`/hospital-operations/incidents/${item.id}/status`, {
          status,
          ...(resolutionNote ? { resolutionNote } : {}),
        }),
      { title: `Sự cố: ${labels[status] ?? status}`, description: item.title },
    );
    if (result.ok) setRefresh((value) => value + 1);
  }

  async function submitEquipment(event: FormEvent) {
    event.preventDefault();
    const payload = {
      ...equipmentForm,
      departmentId: Number(equipmentForm.departmentId),
      assigneeId: Number(equipmentForm.assigneeId),
      checklist: equipmentForm.checklist
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      active: true,
    };
    const action = () =>
      editingEquipmentId
        ? api.put(
            `/hospital-operations/equipment/${editingEquipmentId}`,
            payload,
          )
        : api.post("/hospital-operations/equipment", payload);
    const result = await runAction(action, {
      title: editingEquipmentId ? "Đã cập nhật thiết bị" : "Đã thêm thiết bị",
    });
    if (result.ok) {
      setEditingEquipmentId(null);
      setEquipmentForm({
        departmentId: String(user?.departmentId ?? ""),
        assigneeId: "",
        assetCode: "",
        name: "",
        location: "",
        checklist: "",
        inspectionCadence: "daily",
        nextInspectionDate: dateToday(),
        maintenanceCadence: "monthly",
        nextMaintenanceDate: dateToday(),
      });
      setRefresh((value) => value + 1);
    }
  }

  async function submitInspection(event: FormEvent) {
    event.preventDefault();
    if (inspectionEquipment == null) return;
    const item = equipment.find(
      (candidate) => candidate.id === inspectionEquipment,
    );
    if (
      !item ||
      item.checklist.some((_, index) => inspectionResults[index] === undefined)
    )
      return;
    const result = await runAction(
      () =>
        api.post(`/hospital-operations/equipment/${item.id}/inspections`, {
          results: item.checklist.map((_, index) => ({
            itemIndex: index + 1,
            passed: inspectionResults[index],
          })),
        }),
      { title: "Đã lưu kết quả kiểm tra", description: item.name },
    );
    if (result.ok) {
      setInspectionEquipment(null);
      setInspectionResults({});
      setRefresh((value) => value + 1);
    }
  }

  async function recordMaintenance(item: Equipment) {
    const notes = window.prompt(
      `Ghi nhận nội dung bảo trì cho ${item.name}:`,
      "",
    );
    if (!notes?.trim()) return;
    const result = await runAction(
      () =>
        api.post(`/hospital-operations/equipment/${item.id}/maintenance`, {
          notes,
        }),
      { title: "Đã ghi nhận bảo trì", description: item.name },
    );
    if (result.ok) setRefresh((value) => value + 1);
  }

  return (
    <div className="dashboard-page hospital-operations-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Nghiệp vụ bệnh viện</span>
          <h3 className="page-title">Điều phối & an toàn vận hành</h3>
          <p className="page-description">
            Yêu cầu liên khoa, theo dõi sự cố checklist và kiểm tra thiết bị.
          </p>
        </div>
      </div>
      {error ? (
        <div className="workflow-alert" role="alert">
          {error}
        </div>
      ) : null}
      {enabled === false ? (
        <div className="panel-card hospital-disabled">
          <strong>Chức năng chưa được bật trên máy chủ.</strong>
          <p>
            Admin cần áp dụng migration{" "}
            <code>scripts/hospital-operations-schema.cjs --apply</code> rồi bật{" "}
            <code>HOSPITAL_OPERATIONS_ENABLED=true</code>. Dữ liệu checklist
            hiện tại không bị thay đổi.
          </p>
        </div>
      ) : null}
      {enabled ? (
        <>
          <div
            className="workflow-tabs"
            role="tablist"
            aria-label="Nghiệp vụ bệnh viện"
          >
            {(
              [
                ["requests", "Yêu cầu liên khoa"],
                ["incidents", "Sự cố checklist"],
                ["equipment", "Thiết bị & kiểm tra"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "requests" ? (
            <section className="hospital-grid">
              <form
                className="panel-card hospital-form"
                onSubmit={submitRequest}
              >
                <h4>Gửi yêu cầu sang khoa/phòng khác</h4>
                {user?.role === "admin" ? (
                  <label>
                    Khoa/phòng gửi
                    <select
                      required
                      value={sourceDepartmentId}
                      onChange={(event) => {
                        setSourceDepartmentId(event.target.value);
                        setTargetDepartmentId("");
                        setRequestForm((form) => ({
                          ...form,
                          assigneeId: "",
                        }));
                      }}
                    >
                      <option value="">Chọn khoa/phòng</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  Khoa/phòng nhận
                  <select
                    required
                    value={targetDepartmentId}
                    onChange={(event) => {
                      setTargetDepartmentId(event.target.value);
                      setRequestForm((form) => ({ ...form, assigneeId: "" }));
                    }}
                  >
                    <option value="">Chọn khoa/phòng</option>
                    {departments
                      .filter(
                        (department) =>
                          department.id !== Number(sourceDepartmentId),
                      )
                      .map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Người nhận
                  <select
                    required
                    value={requestForm.assigneeId}
                    onChange={(event) =>
                      setRequestForm((form) => ({
                        ...form,
                        assigneeId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Chọn người xử lý</option>
                    {recipients
                      .filter(
                        (person) =>
                          String(person.departmentId) === targetDepartmentId,
                      )
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Nội dung
                  <input
                    required
                    maxLength={255}
                    value={requestForm.title}
                    onChange={(event) =>
                      setRequestForm((form) => ({
                        ...form,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Mô tả công việc
                  <textarea
                    maxLength={4000}
                    value={requestForm.description}
                    onChange={(event) =>
                      setRequestForm((form) => ({
                        ...form,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="hospital-form-row">
                  <label>
                    Hạn xử lý
                    <input
                      type="date"
                      required
                      value={requestForm.dueDate}
                      onChange={(event) =>
                        setRequestForm((form) => ({
                          ...form,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Ưu tiên
                    <select
                      value={requestForm.priority}
                      onChange={(event) =>
                        setRequestForm((form) => ({
                          ...form,
                          priority: event.target.value,
                        }))
                      }
                    >
                      <option value="low">Thấp</option>
                      <option value="medium">Bình thường</option>
                      <option value="high">Cao</option>
                    </select>
                  </label>
                </div>
                <button
                  className="primary-action"
                  disabled={!requestForm.assigneeId}
                >
                  Gửi yêu cầu
                </button>
              </form>
              <section className="hospital-list">
                <h4>Yêu cầu của khoa / gửi đến khoa</h4>
                {requests.map((item) => {
                  const canProcess =
                    user?.role === "admin" ||
                    item.assigneeId === user?.id ||
                    (user?.role === "manager" &&
                      item.targetDepartmentId === user.departmentId);
                  return (
                  <article className="panel-card hospital-item" key={item.id}>
                    <div className="hospital-item-heading">
                      <strong>{item.title}</strong>
                      <span className={`workflow-state ${item.status}`}>
                        {labels[item.status] ?? item.status}
                      </span>
                    </div>
                    <p>
                      {item.sourceDepartmentName} → {item.targetDepartmentName}
                    </p>
                    <p>
                      Người nhận: {item.assigneeName} · Hạn:{" "}
                      {item.dueDate?.slice(0, 10)}
                    </p>
                    {item.description ? <p>{item.description}</p> : null}
                    <div className="workflow-inline-actions">
                      {item.status === "pending" && canProcess ? (
                        <>
                          <button
                            className="secondary-action"
                            onClick={() => void changeRequest(item, "accepted")}
                          >
                            Tiếp nhận
                          </button>
                          <button
                            className="secondary-action"
                            onClick={() => void changeRequest(item, "rejected")}
                          >
                            Từ chối
                          </button>
                        </>
                      ) : null}
                      {item.status === "accepted" && canProcess ? (
                        <button
                          className="secondary-action"
                          onClick={() =>
                            void changeRequest(item, "in_progress")
                          }
                        >
                          Bắt đầu xử lý
                        </button>
                      ) : null}
                      {item.status === "in_progress" && canProcess ? (
                        <button
                          className="secondary-action"
                          onClick={() => void changeRequest(item, "completed")}
                        >
                          Hoàn thành
                        </button>
                      ) : null}
                      {["pending", "accepted", "in_progress"].includes(
                        item.status,
                      ) &&
                      (item.requesterId === user?.id ||
                        item.assigneeId === user?.id ||
                      user?.role === "admin" ||
                      (user?.role === "manager" &&
                        (item.sourceDepartmentId === user.departmentId ||
                          item.targetDepartmentId === user.departmentId))) ? (
                        <button
                          className="secondary-action"
                          onClick={() => void changeRequest(item, "cancelled")}
                        >
                          Hủy yêu cầu
                        </button>
                      ) : null}
                    </div>
                  </article>
                  );
                })}
                {!loading && !requests.length ? (
                  <div className="panel-card hospital-empty">
                    Chưa có yêu cầu liên khoa.
                  </div>
                ) : null}
              </section>
            </section>
          ) : null}
          {tab === "incidents" ? (
            <section className="hospital-grid">
              <form
                className="panel-card hospital-form"
                onSubmit={submitIncident}
              >
                <h4>Báo sự cố từ checklist</h4>
                <label>
                  Công việc
                  <select
                    required
                    value={selectedTaskId}
                    onChange={(event) => {
                      setSelectedTaskId(event.target.value);
                      setSelectedChecklistId("");
                      setIncidentForm((form) => ({ ...form, assigneeId: "" }));
                    }}
                  >
                    <option value="">Chọn công việc</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Mục checklist
                  <select
                    required
                    value={selectedChecklistId}
                    onChange={(event) =>
                      setSelectedChecklistId(event.target.value)
                    }
                  >
                    <option value="">Chọn mục không đạt</option>
                    {selectedTask?.checklist
                      ?.filter((item) => item.outcome !== "fail")
                      .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                      ))}
                  </select>
                </label>
                <label>
                  Người xử lý
                  <select
                    required
                    value={incidentForm.assigneeId}
                    onChange={(event) =>
                      setIncidentForm((form) => ({
                        ...form,
                        assigneeId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Chọn người xử lý</option>
                    {recipients
                      .filter(
                        (person) =>
                          person.departmentId === selectedTask?.departmentId,
                      )
                      .map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Tiêu đề sự cố
                  <input
                    required
                    maxLength={255}
                    value={incidentForm.title}
                    onChange={(event) =>
                      setIncidentForm((form) => ({
                        ...form,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Mô tả / nguyên nhân (bắt buộc)
                  <textarea
                    required
                    minLength={3}
                    maxLength={4000}
                    value={incidentForm.description}
                    onChange={(event) =>
                      setIncidentForm((form) => ({
                        ...form,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="hospital-form-row">
                  <label>
                    Mức độ
                    <select
                      value={incidentForm.severity}
                      onChange={(event) =>
                        setIncidentForm((form) => ({
                          ...form,
                          severity: event.target.value,
                        }))
                      }
                    >
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                      <option value="critical">Nghiêm trọng</option>
                    </select>
                  </label>
                  <label>
                    Hạn xử lý
                    <input
                      type="date"
                      required
                      value={incidentForm.dueDate}
                      onChange={(event) =>
                        setIncidentForm((form) => ({
                          ...form,
                          dueDate: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <button
                  className="primary-action"
                  disabled={
                    !selectedChecklist ||
                    !incidentForm.assigneeId ||
                    incidentForm.description.trim().length < 3
                  }
                >
                  Tạo phiếu sự cố
                </button>
              </form>
              <section className="hospital-list">
                <h4>Theo dõi khắc phục</h4>
                {incidents.map((item) => (
                  <article className="panel-card hospital-item" key={item.id}>
                    <div className="hospital-item-heading">
                      <strong>{item.title}</strong>
                      <span className={`workflow-state ${item.status}`}>
                        {labels[item.status] ?? item.status}
                      </span>
                    </div>
                    <p>
                      {item.departmentName} · Mức độ {item.severity} · Hạn{" "}
                      {item.dueDate?.slice(0, 10)}
                    </p>
                    <p>
                      Xử lý: {item.assigneeName} · Công việc #{item.taskId}
                    </p>
                    {item.description ? <p>{item.description}</p> : null}
                    <div className="workflow-inline-actions">
                      {item.status === "open" &&
                      item.assigneeId === user?.id ? (
                        <button
                          className="secondary-action"
                          onClick={() =>
                            void changeIncident(item, "in_progress")
                          }
                        >
                          Bắt đầu
                        </button>
                      ) : null}
                      {item.status === "in_progress" &&
                      item.assigneeId === user?.id ? (
                        <button
                          className="secondary-action"
                          onClick={() => void changeIncident(item, "resolved")}
                        >
                          Ghi nhận khắc phục
                        </button>
                      ) : null}
                      {item.status === "resolved" &&
                      (user?.role === "admin" ||
                        (user?.role === "manager" &&
                          user.departmentId === item.departmentId)) ? (
                        <button
                          className="secondary-action"
                          onClick={() => void changeIncident(item, "closed")}
                        >
                          Đóng phiếu
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
                {!loading && !incidents.length ? (
                  <div className="panel-card hospital-empty">
                    Chưa có phiếu sự cố.
                  </div>
                ) : null}
              </section>
            </section>
          ) : null}
          {tab === "equipment" ? (
            <section className="hospital-grid">
              {manageEquipment ? (
                <form
                  className="panel-card hospital-form"
                  onSubmit={submitEquipment}
                >
                  <h4>
                    {editingEquipmentId
                      ? "Cập nhật thiết bị"
                      : "Thêm thiết bị / tài sản"}
                  </h4>
                  {user?.role === "admin" ? (
                    <label>
                      Khoa/phòng
                      <select
                        required
                        value={equipmentDepartmentId}
                        onChange={(event) => {
                          setEquipmentDepartmentId(event.target.value);
                          setEquipmentForm((form) => ({
                            ...form,
                            departmentId: event.target.value,
                            assigneeId: "",
                          }));
                        }}
                      >
                        <option value="">Chọn khoa/phòng</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    Mã tài sản
                    <input
                      required
                      maxLength={80}
                      value={equipmentForm.assetCode}
                      onChange={(event) =>
                        setEquipmentForm((form) => ({
                          ...form,
                          assetCode: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Tên thiết bị
                    <input
                      required
                      maxLength={255}
                      value={equipmentForm.name}
                      onChange={(event) =>
                        setEquipmentForm((form) => ({
                          ...form,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Vị trí
                    <input
                      maxLength={255}
                      value={equipmentForm.location}
                      onChange={(event) =>
                        setEquipmentForm((form) => ({
                          ...form,
                          location: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Người phụ trách
                    <select
                      required
                      value={equipmentForm.assigneeId}
                      onChange={(event) =>
                        setEquipmentForm((form) => ({
                          ...form,
                          assigneeId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Chọn người phụ trách</option>
                      {equipmentPeople.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Checklist thiết bị (mỗi dòng một mục)
                    <textarea
                      required
                      value={equipmentForm.checklist}
                      onChange={(event) =>
                        setEquipmentForm((form) => ({
                          ...form,
                          checklist: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="hospital-form-row">
                    <label>
                      Chu kỳ kiểm tra
                      <select
                        value={equipmentForm.inspectionCadence}
                        onChange={(event) =>
                          setEquipmentForm((form) => ({
                            ...form,
                            inspectionCadence: event.target.value,
                          }))
                        }
                      >
                        <option value="daily">Hằng ngày</option>
                        <option value="weekly">Hằng tuần</option>
                        <option value="monthly">Hằng tháng</option>
                      </select>
                    </label>
                    <label>
                      Kiểm tra tiếp theo
                      <input
                        type="date"
                        required
                        value={equipmentForm.nextInspectionDate}
                        onChange={(event) =>
                          setEquipmentForm((form) => ({
                            ...form,
                            nextInspectionDate: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="hospital-form-row">
                    <label>
                      Chu kỳ bảo trì
                      <select
                        value={equipmentForm.maintenanceCadence}
                        onChange={(event) =>
                          setEquipmentForm((form) => ({
                            ...form,
                            maintenanceCadence: event.target.value,
                          }))
                        }
                      >
                        <option value="none">Không định kỳ</option>
                        <option value="daily">Hằng ngày</option>
                        <option value="weekly">Hằng tuần</option>
                        <option value="monthly">Hằng tháng</option>
                      </select>
                    </label>
                    <label>
                      Bảo trì tiếp theo
                      <input
                        type="date"
                        value={equipmentForm.nextMaintenanceDate}
                        onChange={(event) =>
                          setEquipmentForm((form) => ({
                            ...form,
                            nextMaintenanceDate: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <button className="primary-action">Lưu thiết bị</button>
                  {editingEquipmentId ? (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => setEditingEquipmentId(null)}
                    >
                      Hủy sửa
                    </button>
                  ) : null}
                </form>
              ) : null}
              <section className="hospital-list">
                <h4>Danh mục & lịch kiểm tra</h4>
                {equipment.map((item) => (
                  <article className="panel-card hospital-item" key={item.id}>
                    <div className="hospital-item-heading">
                      <strong>{item.name}</strong>
                      <span className="workflow-state">{item.assetCode}</span>
                    </div>
                    <p>
                      {item.departmentName} ·{" "}
                      {item.location || "Chưa ghi vị trí"} · Phụ trách:{" "}
                      {item.assigneeName}
                    </p>
                    <p>
                      Kiểm tra {cadenceLabel(item.inspectionCadence)} · Hạn
                      tiếp: {item.nextInspectionDate?.slice(0, 10)}
                    </p>
                    <p>
                      Bảo trì {cadenceLabel(item.maintenanceCadence)}
                      {item.nextMaintenanceDate
                        ? ` · Hạn tiếp: ${item.nextMaintenanceDate.slice(0, 10)}`
                        : ""}
                    </p>
                    <details>
                      <summary>Mã QR / đường dẫn thiết bị</summary>
                      <code>{item.qrCode}</code>
                      <p className="hospital-muted">
                        Mã định danh đã sẵn sàng để in thành QR bằng công cụ nội
                        bộ được bệnh viện phê duyệt.
                      </p>
                    </details>
                    <div className="workflow-inline-actions">
                      {item.active ? (
                        <button
                          className="secondary-action"
                          onClick={() => {
                            setInspectionEquipment(item.id);
                            setInspectionResults({});
                          }}
                        >
                          Thực hiện checklist
                        </button>
                      ) : null}
                      {item.active &&
                      item.maintenanceCadence !== "none" &&
                      item.nextMaintenanceDate &&
                      (item.assigneeId === user?.id ||
                        user?.role === "admin" ||
                        (user?.role === "manager" &&
                          user.departmentId === item.departmentId)) ? (
                        <button
                          className="secondary-action"
                          onClick={() => void recordMaintenance(item)}
                        >
                          Ghi nhận bảo trì
                        </button>
                      ) : null}
                      {manageEquipment ? (
                        <button
                          className="secondary-action"
                          onClick={() => {
                            setEditingEquipmentId(item.id);
                            setEquipmentDepartmentId(String(item.departmentId));
                            setEquipmentForm({
                              departmentId: String(item.departmentId),
                              assigneeId: String(item.assigneeId),
                              assetCode: item.assetCode,
                              name: item.name,
                              location: item.location ?? "",
                              checklist: item.checklist.join("\n"),
                              inspectionCadence: item.inspectionCadence,
                              nextInspectionDate: item.nextInspectionDate.slice(
                                0,
                                10,
                              ),
                              maintenanceCadence: item.maintenanceCadence,
                              nextMaintenanceDate:
                                item.nextMaintenanceDate?.slice(0, 10) ??
                                dateToday(),
                            });
                          }}
                        >
                          Sửa
                        </button>
                      ) : null}
                    </div>
                    {inspectionEquipment === item.id ? (
                      <form
                        className="hospital-inspection"
                        onSubmit={submitInspection}
                      >
                        <h5>Checklist kiểm tra</h5>
                        {item.checklist.map((line, index) => (
                          <label
                            className="hospital-result"
                            key={`${index}-${line}`}
                          >
                            {line}
                            <select
                              required
                              value={
                                inspectionResults[index] === undefined
                                  ? ""
                                  : inspectionResults[index]
                                    ? "pass"
                                    : "fail"
                              }
                              onChange={(event) =>
                                setInspectionResults((current) => ({
                                  ...current,
                                  [index]: event.target.value === "pass",
                                }))
                              }
                            >
                              <option value="">Chọn kết quả</option>
                              <option value="pass">Đạt</option>
                              <option value="fail">Không đạt</option>
                            </select>
                          </label>
                        ))}
                        <button
                          className="primary-action"
                          disabled={item.checklist.some(
                            (_, index) =>
                              inspectionResults[index] === undefined,
                          )}
                        >
                          Lưu kết quả
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => setInspectionEquipment(null)}
                        >
                          Hủy
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
                {!loading && !equipment.length ? (
                  <div className="panel-card hospital-empty">
                    Chưa có thiết bị trong phạm vi.
                  </div>
                ) : null}
              </section>
            </section>
          ) : null}
          {loading ? <p role="status">Đang tải dữ liệu…</p> : null}
        </>
      ) : null}
    </div>
  );
}
