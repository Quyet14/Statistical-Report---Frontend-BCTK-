"use client";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useFeedback } from "@/context/FeedbackContext";
import { ManagementDialog } from "@/components/management/ManagementDialog";
import {
  ApartmentOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
type Person = {
  id: number;
  name: string;
  email: string;
  role: string;
  departmentId: number;
  isActive: boolean;
};
type Member = {
  userId: number;
  name: string;
  position: string;
  isActive: boolean;
};
type Team = {
  id: number;
  name: string;
  departmentId: number;
  leaderId: number;
  leaderName: string;
  active: boolean;
  members: Member[];
};
type Tree = {
  branches: { id: number; name: string }[];
  departments: { id: number; name: string; branchId?: number }[];
  teams: Team[];
  people: Person[];
};
const roles: Record<string, string> = {
  admin: "Quản trị viên",
  manager: "Trưởng khoa",
  leader: "Trưởng nhóm",
  staff: "Nhân viên",
  viewer: "Chỉ xem",
};
const emptyForm = {
  name: "",
  departmentId: "",
  leaderId: "",
  active: true,
  members: {} as Record<string, string>,
};
export default function OrganizationPage() {
  const user = getStoredUser();
  const [, startTransition] = useTransition();
  const canManage = !!user && ["admin", "manager"].includes(user.role);
  const [tree, setTree] = useState<Tree>({
    branches: [],
    departments: [],
    teams: [],
    people: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const { runAction } = useFeedback();
  useEffect(() => {
    let current = true;
    startTransition(() => {
      setLoading(true);
      setError("");
    });
    void api
      .get<Tree>("/organization")
      .then((value) => {
        if (current) setTree(value);
      })
      .catch((reason) => {
        if (current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được cơ cấu tổ chức.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [reload]);
  const departmentPeople = tree.people.filter(
    (person) =>
      String(person.departmentId) === form.departmentId && person.isActive,
  );
  const leaders = departmentPeople.filter((person) =>
    ["leader", "manager"].includes(person.role),
  );
  const departments = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("vi");
    return tree.departments.filter(
      (department) =>
        !text ||
        department.name.toLocaleLowerCase("vi").includes(text) ||
        tree.teams.some(
          (team) =>
            team.departmentId === department.id &&
            [
              team.name,
              team.leaderName,
              ...team.members.map((m) => m.name),
            ].some((value) => value?.toLocaleLowerCase("vi").includes(text)),
        ) ||
        tree.people.some(
          (person) =>
            person.departmentId === department.id &&
            person.name.toLocaleLowerCase("vi").includes(text),
        ),
    );
  }, [tree, query]);
  const groups = [
    ...tree.branches.map((branch) => ({
      ...branch,
      departments: departments.filter((d) => d.branchId === branch.id),
    })),
    {
      id: 0,
      name: "Đơn vị trực thuộc",
      departments: departments.filter(
        (d) => !d.branchId || !tree.branches.some((b) => b.id === d.branchId),
      ),
    },
  ].filter((group) => group.departments.length);
  function open(team?: Team) {
    setEditing(team?.id ?? "new");
    setForm(
      team
        ? {
            name: team.name,
            departmentId: String(team.departmentId),
            leaderId: String(team.leaderId),
            active: team.active,
            members: Object.fromEntries(
              team.members.map((member) => [
                String(member.userId),
                member.position,
              ]),
            ),
          }
        : { ...emptyForm, departmentId: String(tree.departments[0]?.id ?? "") },
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      departmentId: Number(form.departmentId),
      leaderId: Number(form.leaderId),
      active: form.active,
      members: Object.entries(form.members)
        .filter(
          ([id]) =>
            departmentPeople.some((p) => String(p.id) === id) &&
            id !== form.leaderId,
        )
        .map(([id, position]) => ({ userId: Number(id), position })),
    };
    try {
      const result = await runAction(
        () =>
          editing === "new"
            ? api.post("/organization/teams", payload)
            : api.put(`/organization/teams/${editing}`, payload),
        {
          title:
            editing === "new" ? "Đã tạo nhóm làm việc" : "Đã cập nhật nhóm",
          description: payload.name,
        },
      );
      if (result.ok) {
        setEditing(null);
        setReload((value) => value + 1);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard-page organization-page">
      <div className="page-header">
        <div>
          <span className="eyebrow">Kết nối đội ngũ</span>
          <h3 className="page-title">Cơ cấu tổ chức & nhóm</h3>
        </div>
        {canManage ? (
          <button
            className="primary-action"
            disabled={loading || !tree.departments.length}
            onClick={() => open()}
          >
            + Tạo nhóm
          </button>
        ) : (
          <span className="status-badge success">
            {user?.role === "viewer"
              ? "Chế độ chỉ xem"
              : "Nhóm do bạn phụ trách"}
          </span>
        )}
      </div>
      <div className="stats-grid">
        <div className="stat-card metric-card blue">
          <ApartmentOutlined />
          <span className="stat-label">Khoa/phòng</span>
          <strong className="stat-value">{tree.departments.length}</strong>
        </div>
        <div className="stat-card metric-card violet">
          <TeamOutlined />
          <span className="stat-label">Nhóm đang hoạt động</span>
          <strong className="stat-value">
            {tree.teams.filter((t) => t.active).length}
          </strong>
        </div>
        <div className="stat-card metric-card green">
          <UserOutlined />
          <span className="stat-label">Nhân sự trong phạm vi</span>
          <strong className="stat-value">{tree.people.length}</strong>
        </div>
      </div>
      <label className="organization-search">
        Tìm khoa, nhóm hoặc nhân sự
        <input
          className="auth-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập tên cần tìm…"
        />
      </label>
      {error ? (
        <div role="alert" className="workflow-alert">
          {error}
          <button
            className="secondary-action"
            onClick={() => setReload((value) => value + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : null}
      {loading ? <p role="status">Đang tải cơ cấu tổ chức…</p> : null}
      <div className="organization-tree">
        {groups.map((group) => (
          <section key={group.id} className="organization-branch">
            <h4>
              <ApartmentOutlined /> {group.name}
            </h4>
            {group.departments.map((department) => {
              const teams = tree.teams.filter(
                (team) => team.departmentId === department.id,
              );
              const people = tree.people.filter(
                (p) => p.departmentId === department.id,
              );
              return (
                <details
                  key={department.id}
                  open
                  className="panel-card organization-department"
                >
                  <summary>
                    <span>{department.name}</span>
                    <small>
                      {people.length} nhân sự · {teams.length} nhóm
                    </small>
                  </summary>
                  <div className="organization-team-grid">
                    {teams.map((team) => (
                      <article
                        key={team.id}
                        className={`organization-team ${team.active ? "" : "is-paused"}`}
                      >
                        <div className="organization-team-heading">
                          <TeamOutlined />
                          <span
                            className={`workflow-state ${team.active ? "approved" : "draft"}`}
                          >
                            {team.active ? "Đang hoạt động" : "Tạm dừng"}
                          </span>
                        </div>
                        <h5>{team.name}</h5>
                        <p>
                          Phụ trách: <strong>{team.leaderName}</strong>
                        </p>
                        <div className="organization-member-list">
                          <div>
                            <span className="organization-avatar">
                              {team.leaderName?.trim().split(/\s+/).pop()?.[0]}
                            </span>
                            <div>
                              <strong>{team.leaderName}</strong>
                              <small>Phụ trách nhóm</small>
                            </div>
                          </div>
                          {team.members
                            .filter((m) => m.userId !== team.leaderId)
                            .map((member) => (
                              <div key={member.userId}>
                                <span className="organization-avatar">
                                  {member.name?.trim().split(/\s+/).pop()?.[0]}
                                </span>
                                <div>
                                  <strong>{member.name}</strong>
                                  <small>
                                    {member.position || "Thành viên"}
                                    {!member.isActive
                                      ? " · Đã vô hiệu hóa"
                                      : ""}
                                  </small>
                                </div>
                              </div>
                            ))}
                        </div>
                        <footer>
                          <small>
                            {
                              new Set([
                                team.leaderId,
                                ...team.members.map((m) => m.userId),
                              ]).size
                            }{" "}
                            nhân sự
                          </small>
                          {canManage ? (
                            <button
                              className="secondary-action"
                              onClick={() => open(team)}
                            >
                              Chỉnh sửa nhóm
                            </button>
                          ) : null}
                        </footer>
                      </article>
                    ))}
                    {!teams.length ? (
                      <p className="workflow-empty">
                        Chưa có nhóm làm việc trong khoa/phòng này.
                      </p>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </section>
        ))}
      </div>
      {!loading && !error && !departments.length ? (
        <div className="panel-card workflow-empty">
          Không tìm thấy đơn vị trong phạm vi của bạn.
        </div>
      ) : null}
      {editing !== null ? (
        <ManagementDialog
          title={editing === "new" ? "Tạo nhóm làm việc" : "Chỉnh sửa nhóm"}
          busy={busy}
          onClose={() => setEditing(null)}
        >
          <form className="management-form" onSubmit={save}>
            <label>
              Tên nhóm
              <input
                autoFocus
                required
                maxLength={150}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <div className="management-form-row">
              <label>
                Khoa/phòng
                <select
                  required
                  disabled={editing !== "new"}
                  value={form.departmentId}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      departmentId: e.target.value,
                      leaderId: "",
                      members: {},
                    })
                  }
                >
                  <option value="">Chọn khoa/phòng</option>
                  {tree.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Người phụ trách nhóm
                <select
                  required
                  value={form.leaderId}
                  onChange={(e) =>
                    setForm({ ...form, leaderId: e.target.value })
                  }
                >
                  <option value="">Chọn trưởng nhóm</option>
                  {leaders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {roles[p.role]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!leaders.length ? (
              <p className="management-scope-note">
                Cần tài khoản có quyền trưởng nhóm/trưởng khoa đang hoạt động
                trong khoa. Admin cấp quyền tại Quản lý nhân viên.
              </p>
            ) : null}
            <fieldset className="organization-members-picker">
              <legend>Thành viên & vị trí</legend>
              {departmentPeople
                .filter(
                  (p) =>
                    p.id !== Number(form.leaderId) &&
                    !["admin", "viewer"].includes(p.role),
                )
                .map((person) => (
                  <div key={person.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Object.hasOwn(form.members, String(person.id))}
                        onChange={(e) =>
                          setForm((current) => {
                            const members = { ...current.members };
                            if (e.target.checked)
                              members[String(person.id)] = "";
                            else delete members[String(person.id)];
                            return { ...current, members };
                          })
                        }
                      />
                      {person.name}
                    </label>
                    {Object.hasOwn(form.members, String(person.id)) ? (
                      <input
                        aria-label={`Vị trí của ${person.name}`}
                        maxLength={100}
                        placeholder="Vị trí trong nhóm"
                        value={form.members[String(person.id)]}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            members: {
                              ...form.members,
                              [person.id]: e.target.value,
                            },
                          })
                        }
                      />
                    ) : null}
                  </div>
                ))}
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />{" "}
              Nhóm đang hoạt động
            </label>
            <p className="management-scope-note">
              Tạm dừng nhóm sẽ thu hồi phạm vi quản lý theo nhóm; công việc và
              lịch sử vẫn được giữ.
            </p>
            <div className="management-dialog-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
              <button
                className="primary-action"
                disabled={busy || !form.leaderId}
              >
                {busy ? "Đang lưu…" : "Lưu nhóm"}
              </button>
            </div>
          </form>
        </ManagementDialog>
      ) : null}
    </div>
  );
}
