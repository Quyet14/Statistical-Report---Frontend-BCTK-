import {
  unlock,
  saveUnlocked,
  discard,
  pendingChanges,
  pendingCount,
  watchDiscard,
} from "./offline-vault.js";
const $ = (id) => document.getElementById(id);
let session = null,
  busy = false,
  idleTimer,
  conflict = null;
const say = (text) => {
  $("message").textContent = text;
};
function lock() {
  session = null;
  conflict = null;
  clearTimeout(idleTimer);
  $("phrase").value = "";
  $("tasks").replaceChildren();
  $("work").hidden = true;
  $("unlock").hidden = false;
  if ($("conflict").open) $("conflict").close();
}
function activity() {
  clearTimeout(idleTimer);
  if (session)
    idleTimer = setTimeout(() => {
      lock();
      say("Đã khóa bản lưu sau 10 phút không thao tác.");
    }, 600000);
}
watchDiscard(() => {
  lock();
  say("Bản ngoại tuyến đã bị xóa ở cửa sổ khác.");
});
function network() {
  $("network").textContent = navigator.onLine
    ? "Có kết nối mạng · Đồng bộ bằng nút bên dưới"
    : "Đang ngoại tuyến · Dấu chọn được mã hóa và lưu trên thiết bị";
}
network();
addEventListener("online", network);
addEventListener("offline", network);
addEventListener("pointerdown", activity);
addEventListener("keydown", activity);
function controls(value) {
  busy = value;
  for (const el of document.querySelectorAll("button,input"))
    el.disabled = value || el.dataset.readonly === "true";
}
async function call(path, body) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) {
    const error = new Error(
      response.status === 401
        ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại, rồi mở bản ngoại tuyến để đồng bộ."
        : response.status === 403
          ? "Không đủ quyền. Bản lưu chưa đồng bộ vẫn được giữ để bạn kiểm tra."
          : response.status === 429
            ? "Đang bị giới hạn yêu cầu; hãy chờ rồi thử lại."
            : typeof data.message === "string"
              ? data.message
              : "Không thể đồng bộ. Hãy kiểm tra kết nối và thử lại.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
function text(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}
function render() {
  if (!session) return;
  $("unlock").hidden = true;
  $("work").hidden = false;
  $("summary").textContent =
    `${session.payload.tasks.length} công việc · ${pendingCount(session.payload)} thay đổi chưa đồng bộ · Hết hạn ${new Date(session.record.expiresAt).toLocaleString("vi-VN")}`;
  $("tasks").replaceChildren();
  for (const task of session.payload.tasks) {
    const card = document.createElement("article");
    card.append(
      text("h2", task.title),
      text(
        "p",
        task.conflict
          ? "Có xung đột · Cần kiểm tra trước khi đồng bộ"
          : `Tiến độ trên máy chủ: ${task.progress}%`,
        "meta",
      ),
    );
    if (task.conflict) {
      const button = text("button", "Kiểm tra bản máy chủ");
      button.onclick = () => resolveConflict(task.id);
      card.append(button);
    }
    for (const item of task.items) {
      const label = document.createElement("label"),
        input = document.createElement("input");
      input.type = "checkbox";
      input.checked = item.draftCompleted;
      input.disabled = !item.editable;
        input.dataset.readonly = String(!item.editable);
      label.append(
        input,
        text(
          "span",
          item.title +
            (item.type === "number"
              ? " · Nhập số khi trực tuyến"
              : item.type === "signature"
                ? " · Ký xác nhận khi trực tuyến"
                : ""),
        ),
      );
      input.onchange = async () => {
        const active = session;
        if (!active || busy) return;
        controls(true);
        const previous = item.draftCompleted;
        item.draftCompleted = input.checked;
        try {
          await saveUnlocked(active.record, active.payload, active.key);
          if (session === active) {
            say("Đã mã hóa và lưu dấu chọn trên thiết bị.");
            render();
          }
        } catch (error) {
          item.draftCompleted = previous;
          input.checked = previous;
          say(error.message);
        } finally {
          controls(false);
          if (session) render();
        }
      };
      card.append(label);
    }
    if (!task.items.length)
      card.append(text("p", "Công việc này không có mục checklist.", "meta"));
    $("tasks").append(card);
  }
}
$("unlock").onsubmit = async (event) => {
  event.preventDefault();
  if (busy) return;
  controls(true);
  try {
    session = await unlock($("phrase").value);
    $("phrase").value = "";
    say(
      "Đã mở bản lưu. Thay đổi chưa gửi lên máy chủ cho đến khi bạn đồng bộ.",
    );
    render();
    activity();
  } catch (error) {
    say(error.message);
  } finally {
    controls(false);
    if (session) render();
  }
};
$("lock").onclick = () => {
  lock();
  say("Đã khóa. Mật khẩu và khóa giải mã không được lưu.");
};
$("discard").onclick = () => $("confirm").showModal();
$("cancel-discard").onclick = () => $("confirm").close();
$("confirm-discard").onclick = async () => {
  controls(true);
  try {
    await discard();
    lock();
    $("confirm").close();
    say("Đã xóa dữ liệu ngoại tuyến trên trình duyệt này.");
  } catch (error) {
    say(error.message);
  } finally {
    controls(false);
  }
};
$("sync").onclick = async () => {
  const active = session;
  if (!active || busy) return;
  controls(true);
  let synced = 0,
    conflicts = 0;
  try {
    const me = await call("/auth/me");
    if (Number(me.id) !== active.record.ownerId)
      throw new Error(
        "Tài khoản đang đăng nhập khác chủ bản lưu. Hãy đăng nhập đúng tài khoản để đồng bộ.",
      );
    for (let index = 0; index < active.payload.tasks.length; index++) {
      if (session !== active) break;
      const task = active.payload.tasks[index],
        changes = pendingChanges(task);
      if (!changes.length) continue;
      if (task.conflict) {
        conflicts++;
        continue;
      }
      try {
        const result = await call(`/work/offline/tasks/${task.id}/sync`, {
          snapshotProof: task.snapshotProof,
          changes,
        });
        active.payload.tasks[index] = {
          ...result.task,
          items: result.task.items.map((item) => ({
            ...item,
            draftCompleted: item.completed,
          })),
        };
        synced++;
      } catch (error) {
        if (error.status === 409 || error.status === 400) {
          task.conflict = true;
          conflicts++;
        } else throw error;
      }
      await saveUnlocked(active.record, active.payload, active.key);
    }
    say(
      `Đã đồng bộ ${synced} công việc.${conflicts ? ` ${conflicts} công việc cần kiểm tra xung đột.` : ""}`,
    );
  } catch (error) {
    say(error.message);
  } finally {
    controls(false);
    if (session === active) render();
  }
};
async function resolveConflict(id) {
  const active = session;
  if (!active || busy) return;
  controls(true);
  try {
    const me = await call("/auth/me");
    if (Number(me.id) !== active.record.ownerId)
      throw new Error("Hãy đăng nhập đúng tài khoản của bản lưu.");
    const fresh = await call("/work/offline/snapshot", { taskIds: [id] });
    if (session !== active) return;
    const local = active.payload.tasks.find((task) => task.id === id),
      server = fresh.tasks[0];
    conflict = { id, server, local, active };
    $("comparison").replaceChildren();
    for (const change of pendingChanges(local)) {
      const old = local.items.find((item) => item.id === change.id),
        now = server.items.find((item) => item.id === change.id);
      $("comparison").append(
        text(
          "p",
          `${old.title}: trên thiết bị ${change.completed ? "đã chọn" : "chưa chọn"}; máy chủ ${now ? (now.completed ? "đã chọn" : "chưa chọn") : "đã xóa"}.${!now?.editable ? " Chỉ có thể xử lý trực tuyến." : ""}`,
        ),
      );
    }
    $("keep-local").disabled = server.locked;
    $("conflict").showModal();
  } catch (error) {
    say(error.message);
  } finally {
    controls(false);
    if (conflict) $("keep-local").disabled = conflict.server.locked;
  }
}
async function choose(local) {
  if (!conflict || busy) return;
  const choice = conflict,
    { active } = choice;
  if (session !== active) return;
  controls(true);
  try {
    const task = {
      ...choice.server,
      items: choice.server.items.map((item) => ({
        ...item,
        draftCompleted: item.completed,
      })),
    };
    if (local)
      for (const change of pendingChanges(choice.local)) {
        const item = task.items.find((item) => item.id === change.id);
        if (item?.editable) item.draftCompleted = change.completed;
      }
    const index = active.payload.tasks.findIndex(
        (task) => task.id === choice.id,
      ),
      previous = active.payload.tasks[index];
    active.payload.tasks[index] = task;
    try {
      await saveUnlocked(active.record, active.payload, active.key);
    } catch (error) {
      active.payload.tasks[index] = previous;
      throw error;
    }
    conflict = null;
    $("conflict").close();
    say(
      local
        ? "Đã đối chiếu vào bản mới. Kiểm tra dấu chọn rồi bấm Đồng bộ để gửi lên máy chủ."
        : "Đã dùng bản máy chủ cho công việc này.",
    );
    render();
  } catch (error) {
    say(error.message);
  } finally {
    controls(false);
    if (session === active) render();
  }
}
$("keep-local").onclick = () => choose(true);
$("use-server").onclick = () => choose(false);
$("close-conflict").onclick = () => {
  conflict = null;
  $("conflict").close();
};
setInterval(() => {
  if (session && session.record.expiresAt <= Date.now()) {
    void discard().finally(() => {
      lock();
      say("Bản lưu đã hết hạn 24 giờ. Hãy kết nối mạng để thiết lập bản mới.");
    });
  }
}, 30000);
