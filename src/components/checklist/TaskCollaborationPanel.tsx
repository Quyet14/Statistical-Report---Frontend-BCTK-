"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useTasks } from "@/context/TaskContext";
import { ManagementDialog } from "@/components/management/ManagementDialog";
type Person = { id: number; name: string };
type Field = {
  id: number;
  title: string;
  completed: boolean;
  fieldType: "tick" | "number" | "signature";
  lowerBound: number | null;
  upperBound: number | null;
  numberValue: number | null;
  signedById: number | null;
  signedAt: string | null;
};
type Step = {
  position: number;
  reviewerId: number;
  reviewerName: string;
  state: string;
  reason?: string;
};
type Data = {
  participants: { userId: number; name: string; available: boolean }[];
  steps: Step[];
  fields: Field[];
  people: Person[];
  mentionPeople: Person[];
  canEditMembers: boolean;
  canPlan: boolean;
  canComment: boolean;
  canFill: boolean;
};
type Comment = {
  id: number;
  authorId: number;
  authorName: string;
  body: string;
  mentions: number[] | string;
  createdAt: string;
};
type Comments = { items: Comment[]; total: number; page: number };
type Confirm = {
  title: string;
  message: string;
  action: () => Promise<boolean>;
};
const stepLabels: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};
export function TaskCollaborationPanel({
  taskId,
  revision,
}: {
  taskId: string;
  revision: string;
}) {
  const { refreshTask } = useTasks(),
    user = getStoredUser();
  const [opened, setOpened] = useState(false),
    [data, setData] = useState<Data | null>(null),
    [enabled, setEnabled] = useState<boolean | null>(null),
    [loaded, setLoaded] = useState<string | null>(null);
  const [comments, setComments] = useState<Comments>({
      items: [],
      total: 0,
      page: 1,
    }),
    [members, setMembers] = useState<number[]>([]),
    [reviewers, setReviewers] = useState<Person[]>([]),
    [stages, setStages] = useState<number[]>([]),
    [memberQuery, setMemberQuery] = useState("");
  const [body, setBody] = useState(""),
    [mentions, setMentions] = useState<number[]>([]),
    [values, setValues] = useState<Record<number, string>>({}),
    [signed, setSigned] = useState<Record<number, boolean>>({});
  const [fieldId, setFieldId] = useState(""),
    [kind, setKind] = useState("tick"),
    [lower, setLower] = useState(""),
    [upper, setUpper] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState<Confirm | null>(null);
  const key = JSON.stringify([taskId, revision]);
  const apply = useCallback((next: Data) => {
    setData(next);
    setMembers(next.participants.map((person) => person.userId));
    setStages(next.steps.map((step) => step.reviewerId));
    setValues(
      Object.fromEntries(
        next.fields.map((field) => [
          field.id,
          field.numberValue == null ? "" : String(field.numberValue),
        ]),
      ),
    );
  }, []);
  useEffect(() => {
    if (!opened) return;
    let alive = true;
    void (async () => {
      try {
        const cap = await api.get<{ enabled: boolean }>(
          "/work/collaboration/capabilities",
        );
        if (!alive) return;
        setEnabled(cap.enabled);
        if (cap.enabled) {
          const [next, thread] = await Promise.all([
            api.get<Data>(`/work/collaboration/tasks/${taskId}`),
            api.get<Comments>(`/work/collaboration/tasks/${taskId}/comments`),
          ]);
          if (!alive) return;
          apply(next);
          setComments(thread);
          if (next.canPlan) {
            const options = await api.get<{ reviewers: Person[] }>(
              "/work/lookups",
            );
            if (alive) setReviewers(options.reviewers);
          }
        }
        if (alive) setError("");
      } catch (failure) {
        if (alive) {
          setData(null);
          setError(
            failure instanceof Error
              ? failure.message
              : "Không tải được cộng tác.",
          );
        }
      } finally {
        if (alive) setLoaded(key);
      }
    })();
    return () => {
      alive = false;
    };
  }, [opened, taskId, key, apply]);
  async function perform(
    method: "post" | "put" | "del",
    path: string,
    payload?: unknown,
  ) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (method === "del") await api.del(path);
      else await api[method](path, payload);
      await refreshTask(taskId);
      const [next, thread] = await Promise.all([
        api.get<Data>(`/work/collaboration/tasks/${taskId}`),
        api.get<Comments>(
          `/work/collaboration/tasks/${taskId}/comments?page=${comments.page}`,
        ),
      ]);
      apply(next);
      setComments(thread);
      setSigned({});
      setNotice("Đã lưu thay đổi.");
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Không lưu được thay đổi.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function commentsPage(page: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setComments(
        await api.get<Comments>(
          `/work/collaboration/tasks/${taskId}/comments?page=${page}`,
        ),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Không tải được bình luận.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="task-collaboration"
      onToggle={(event) => {
        if (event.target !== event.currentTarget) return;
        const next = event.currentTarget.open;
        if (next) {
          setLoaded(null);
          setError("");
        }
        setOpened(next);
      }}
    >
      <summary>
        Cộng tác, phê duyệt & bình luận{" "}
        <span>
          {data ? `${data.participants.length} phối hợp` : "Mở chi tiết"}
        </span>
      </summary>
      {opened ? (
        <div
          className="task-collaboration-body"
          aria-busy={busy || loaded !== key}
        >
          {loaded !== key ? <p role="status">Đang tải…</p> : null}
          {enabled === false ? (
            <p>Chức năng chưa được bật trên máy chủ.</p>
          ) : null}
          {error ? (
            <p role="alert" className="coordination-error">
              {error}
            </p>
          ) : null}
          {notice ? <p role="status">{notice}</p> : null}
          {loaded === key && enabled && data ? (
            <>
              <section>
                <h4>Người phối hợp</h4>
                <p>
                  Giữ một người phụ trách chính; KPI không được nhân đôi cho
                  người phối hợp.
                </p>
                {data.participants.length ? (
                  <ul>
                    {data.participants.map((person) => (
                      <li key={person.userId}>
                        {person.name}
                        {!person.available ? " · Cần cập nhật phân công" : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Chưa thêm người phối hợp.</p>
                )}
                {data.canEditMembers ? (
                  <details>
                    <summary>Thiết lập người phối hợp</summary>
                    <label>
                      Tìm nhân viên
                      <input
                        value={memberQuery}
                        maxLength={100}
                        onChange={(event) => setMemberQuery(event.target.value)}
                      />
                    </label>
                    <div className="collaboration-people">
                      {data.people
                        .filter((person) =>
                          person.name
                            .toLocaleLowerCase("vi")
                            .includes(memberQuery.toLocaleLowerCase("vi")),
                        )
                        .map((person) => (
                          <label key={person.id}>
                            <input
                              type="checkbox"
                              checked={members.includes(person.id)}
                              disabled={
                                busy ||
                                (!members.includes(person.id) &&
                                  members.length >= 20)
                              }
                              onChange={(event) =>
                                setMembers((current) =>
                                  event.target.checked
                                    ? [...current, person.id]
                                    : current.filter((id) => id !== person.id),
                                )
                              }
                            />
                            {person.name}
                          </label>
                        ))}
                      {data.participants
                        .filter(
                          (person) =>
                            !data.people.some(
                              (option) => option.id === person.userId,
                            ),
                        )
                        .map((person) => (
                          <label key={person.userId}>
                            <input
                              type="checkbox"
                              checked={members.includes(person.userId)}
                              disabled={busy}
                              onChange={(event) =>
                                setMembers((current) =>
                                  event.target.checked
                                    ? [...current, person.userId]
                                    : current.filter(
                                        (id) => id !== person.userId,
                                      ),
                                )
                              }
                            />
                            {person.name} · Không còn đủ điều kiện
                          </label>
                        ))}
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void perform(
                          "put",
                          `/work/collaboration/tasks/${taskId}/participants`,
                          { userIds: members },
                        )
                      }
                    >
                      Lưu người phối hợp
                    </button>
                  </details>
                ) : null}
              </section>
              <section>
                <h4>Quy trình phê duyệt</h4>
                {data.steps.length ? (
                  <ol className="approval-timeline">
                    {data.steps.map((step) => (
                      <li
                        key={step.position}
                        className={`approval-step-${step.state}`}
                      >
                        <strong>
                          Cấp {step.position} · {step.reviewerName}
                        </strong>
                        <span>{stepLabels[step.state] ?? step.state}</span>
                        {step.reason ? <p>{step.reason}</p> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>
                    Đang dùng người duyệt của công việc nếu đã được chỉ định.
                  </p>
                )}
                {data.canPlan ? (
                  <details>
                    <summary>Cấu hình tối đa 5 cấp duyệt</summary>
                    <p>
                      Mỗi cấp một quản lý khác nhau. Cần đủ tất cả các cấp để
                      ghi nhận hoàn tất; gửi lại sau từ chối sẽ duyệt lại từ cấp
                      đầu.
                    </p>
                    {stages.map((id, index) => (
                      <label key={index}>
                        Cấp {index + 1}
                        <select
                          aria-label={`Người duyệt cấp ${index + 1}`}
                          value={id}
                          disabled={busy}
                          onChange={(event) =>
                            setStages((current) =>
                              current.map((value, position) =>
                                position === index
                                  ? Number(event.target.value)
                                  : value,
                              ),
                            )
                          }
                        >
                          <option value={0}>Chọn quản lý…</option>
                          {reviewers.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setStages((current) =>
                              current.filter(
                                (_, position) => position !== index,
                              ),
                            )
                          }
                        >
                          Bỏ cấp {index + 1}
                        </button>
                      </label>
                    ))}
                    <div className="coordination-actions">
                      <button
                        type="button"
                        disabled={busy || stages.length >= 5}
                        onClick={() => setStages((current) => [...current, 0])}
                      >
                        Thêm cấp duyệt
                      </button>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          stages.some((id) => id < 1) ||
                          new Set(stages).size !== stages.length
                        }
                        onClick={() =>
                          setConfirm({
                            title: "Xác nhận cấu hình phê duyệt",
                            message: stages.length
                              ? `Áp dụng ${stages.length} cấp duyệt theo thứ tự đã chọn.`
                              : "Bỏ yêu cầu phê duyệt của công việc này?",
                            action: () =>
                              perform(
                                "put",
                                `/work/collaboration/tasks/${taskId}/approvals`,
                                { reviewerIds: stages },
                              ),
                          })
                        }
                      >
                        Lưu lộ trình duyệt
                      </button>
                    </div>
                  </details>
                ) : null}
              </section>
              {data.fields.some((field) => field.fieldType !== "tick") ? (
                <section>
                  <h4>Giá trị checklist & ký xác nhận</h4>
                  <p>
                    Ký bằng danh tính tài khoản đang đăng nhập; đây là xác nhận
                    nội bộ, không thay thế chứng thư số.
                  </p>
                  {data.fields
                    .filter((field) => field.fieldType !== "tick")
                    .map((field) => (
                      <div className="collaboration-field" key={field.id}>
                        <strong>{field.title}</strong>
                        {field.fieldType === "number" ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void perform(
                                "post",
                                `/work/collaboration/tasks/${taskId}/fields/${field.id}/value`,
                                {
                                  completed: true,
                                  value: Number(values[field.id]),
                                },
                              );
                            }}
                          >
                            <label>
                              Giá trị số
                              <input
                                aria-label={`Giá trị ${field.title}`}
                                type="number"
                                step="any"
                                required
                                min={field.lowerBound ?? -1000000000}
                                max={field.upperBound ?? 1000000000}
                                disabled={busy || !data.canFill}
                                value={values[field.id] ?? ""}
                                onChange={(event) =>
                                  setValues((current) => ({
                                    ...current,
                                    [field.id]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            <small>
                              {field.lowerBound ?? "Không giới hạn dưới"} →{" "}
                              {field.upperBound ?? "Không giới hạn trên"}
                            </small>
                            {data.canFill ? (
                              <button type="submit" disabled={busy}>
                                Lưu giá trị & hoàn thành mục
                              </button>
                            ) : null}
                          </form>
                        ) : field.completed ? (
                          <p>
                            Đã xác nhận bằng tài khoản #{field.signedById} ·{" "}
                            {field.signedAt
                              ? new Date(field.signedAt).toLocaleString("vi-VN")
                              : ""}
                          </p>
                        ) : data.canFill ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void perform(
                                "post",
                                `/work/collaboration/tasks/${taskId}/fields/${field.id}/value`,
                                { completed: true, sign: true },
                              );
                            }}
                          >
                            <label className="collaboration-check">
                              <input
                                type="checkbox"
                                required
                                checked={!!signed[field.id]}
                                disabled={busy}
                                onChange={(event) =>
                                  setSigned((current) => ({
                                    ...current,
                                    [field.id]: event.target.checked,
                                  }))
                                }
                              />
                              Tôi xác nhận đã thực hiện mục này bằng tài khoản
                              của mình.
                            </label>
                            <button
                              type="submit"
                              disabled={busy || !signed[field.id]}
                            >
                              Ký xác nhận mục
                            </button>
                          </form>
                        ) : (
                          <p>Chưa ký xác nhận.</p>
                        )}
                        {field.completed && data.canFill ? (
                          <button
                            type="button"
                            disabled={
                              busy ||
                              (field.fieldType === "signature" &&
                                field.signedById !== user?.id &&
                                user?.role !== "admin")
                            }
                            onClick={() =>
                              setConfirm({
                                title: "Mở lại mục đã hoàn thành",
                                message: field.title,
                                action: () =>
                                  perform(
                                    "post",
                                    `/work/collaboration/tasks/${taskId}/fields/${field.id}/value`,
                                    { completed: false },
                                  ),
                              })
                            }
                          >
                            Mở lại mục
                          </button>
                        ) : null}
                      </div>
                    ))}
                </section>
              ) : null}
              {data.canPlan ? (
                <details>
                  <summary>Kiểu dữ liệu mục checklist</summary>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void perform(
                        "put",
                        `/work/collaboration/tasks/${taskId}/fields/${fieldId}`,
                        {
                          type: kind,
                          ...(kind === "number" && lower !== ""
                            ? { min: Number(lower) }
                            : {}),
                          ...(kind === "number" && upper !== ""
                            ? { max: Number(upper) }
                            : {}),
                        },
                      );
                    }}
                  >
                    <label>
                      Mục checklist
                      <select
                        aria-label="Mục cần cấu hình"
                        required
                        value={fieldId}
                        onChange={(event) => {
                          setFieldId(event.target.value);
                          const field = data.fields.find(
                            (field) => field.id === Number(event.target.value),
                          );
                          setKind(field?.fieldType ?? "tick");
                          setLower(
                            field?.lowerBound == null
                              ? ""
                              : String(field.lowerBound),
                          );
                          setUpper(
                            field?.upperBound == null
                              ? ""
                              : String(field.upperBound),
                          );
                        }}
                      >
                        <option value="">Chọn mục…</option>
                        {data.fields
                          .filter((field) => !field.completed)
                          .map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.title}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Kiểu dữ liệu
                      <select
                        aria-label="Kiểu mục checklist"
                        value={kind}
                        onChange={(event) => setKind(event.target.value)}
                      >
                        <option value="tick">Đánh dấu hoàn thành</option>
                        <option value="number">Giá trị số</option>
                        <option value="signature">
                          Ký xác nhận bằng tài khoản
                        </option>
                      </select>
                    </label>
                    {kind === "number" ? (
                      <div className="handoff-fields">
                        <label>
                          Giới hạn dưới
                          <input
                            type="number"
                            step="any"
                            min={-1000000000}
                            max={1000000000}
                            value={lower}
                            onChange={(event) => setLower(event.target.value)}
                          />
                        </label>
                        <label>
                          Giới hạn trên
                          <input
                            type="number"
                            step="any"
                            min={-1000000000}
                            max={1000000000}
                            value={upper}
                            onChange={(event) => setUpper(event.target.value)}
                          />
                        </label>
                      </div>
                    ) : null}
                    <button
                      type="submit"
                      disabled={
                        busy ||
                        !fieldId ||
                        (lower !== "" &&
                          upper !== "" &&
                          Number(lower) > Number(upper))
                      }
                    >
                      Lưu kiểu checklist
                    </button>
                  </form>
                </details>
              ) : null}
              <section>
                <h4>Bình luận & nhắc tên</h4>
                {data.canComment ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void (async () => {
                        if (
                          await perform(
                            "post",
                            `/work/collaboration/tasks/${taskId}/comments`,
                            { body, mentions },
                          )
                        ) {
                          setBody("");
                          setMentions([]);
                        }
                      })();
                    }}
                  >
                    <label>
                      Bình luận
                      <textarea
                        aria-label="Nội dung bình luận"
                        required
                        minLength={1}
                        maxLength={2000}
                        value={body}
                        disabled={busy}
                        onChange={(event) => setBody(event.target.value)}
                      />
                    </label>
                    <details>
                      <summary>@ Nhắc người tham gia</summary>
                      <div className="collaboration-people">
                        {data.mentionPeople
                          .filter((person) => person.id !== user?.id)
                          .map((person) => (
                            <label key={person.id}>
                              <input
                                type="checkbox"
                                checked={mentions.includes(person.id)}
                                disabled={busy}
                                onChange={(event) =>
                                  setMentions((current) =>
                                    event.target.checked
                                      ? [...current, person.id]
                                      : current.filter(
                                          (id) => id !== person.id,
                                        ),
                                  )
                                }
                              />
                              @{person.name}
                            </label>
                          ))}
                      </div>
                    </details>
                    <button type="submit" disabled={busy || !body.trim()}>
                      Gửi bình luận
                    </button>
                  </form>
                ) : null}
                <div className="collaboration-comments">
                  {comments.items.map((comment) => (
                    <article key={comment.id}>
                      <strong>{comment.authorName}</strong>
                      <time>
                        {new Date(comment.createdAt).toLocaleString("vi-VN")}
                      </time>
                      <p>{comment.body}</p>
                      {data.canComment && (comment.authorId === user?.id ||
                        user?.role === "admin") ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              title: "Xóa bình luận",
                              message:
                                "Bình luận sẽ được ẩn khỏi thảo luận và giữ dấu vết trong nhật ký.",
                              action: () =>
                                perform(
                                  "del",
                                  `/work/collaboration/tasks/${taskId}/comments/${comment.id}`,
                                ),
                            })
                          }
                        >
                          Xóa bình luận
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
                {!comments.items.length ? <p>Chưa có bình luận.</p> : null}
                {comments.total > 20 ? (
                  <div className="dependency-pagination">
                    <button
                      type="button"
                      disabled={busy || comments.page <= 1}
                      onClick={() => void commentsPage(comments.page - 1)}
                    >
                      Trước
                    </button>
                    <span>
                      Trang {comments.page}/{Math.ceil(comments.total / 20)}
                    </span>
                    <button
                      type="button"
                      disabled={busy || comments.page * 20 >= comments.total}
                      onClick={() => void commentsPage(comments.page + 1)}
                    >
                      Sau
                    </button>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
          {confirm ? (
            <ManagementDialog
              title={confirm.title}
              busy={busy}
              onClose={() => setConfirm(null)}
            >
              <p>{confirm.message}</p>
              {error ? <p role="alert">{error}</p> : null}
              <button
                type="button"
                className="primary-action"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    if (await confirm.action()) setConfirm(null);
                  })()
                }
              >
                Xác nhận
              </button>
            </ManagementDialog>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
