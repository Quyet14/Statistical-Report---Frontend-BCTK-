// Shared by the Next client and the standalone offline screen. No network or
// authentication tokens are stored here. Only ciphertext is written to IDB.
const DB_NAME = "careops-private-offline-v1",
  STORE = "vault",
  DAY = 86400000,
  ITERATIONS = 600000;
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Không mở được vùng lưu ngoại tuyến."));
  });
}
async function transact(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode),
        request = action(transaction.objectStore(STORE));
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () =>
        reject(new Error("Không lưu được dữ liệu ngoại tuyến."));
      transaction.onabort = () =>
        reject(new Error("Không lưu được dữ liệu ngoại tuyến."));
    });
  } finally {
    db.close();
  }
}
function associated(record) {
  return encoder.encode(
    JSON.stringify({
      version: record.version,
      vaultId: record.vaultId,
      ownerId: record.ownerId,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      pendingCount: record.pendingCount,
    }),
  );
}
function validate(record) {
  return (
    record &&
    record.version === 1 &&
    typeof record.vaultId === "string" &&
    /^[a-f0-9-]{36}$/.test(record.vaultId) &&
    Number.isSafeInteger(record.ownerId) &&
    record.ownerId > 0 &&
    Number.isFinite(record.createdAt) &&
    Number.isFinite(record.expiresAt) &&
    record.expiresAt > record.createdAt &&
    record.expiresAt - record.createdAt <= DAY &&
    record.iterations === ITERATIONS &&
    record.salt instanceof ArrayBuffer &&
    record.salt.byteLength === 16 &&
    record.iv instanceof ArrayBuffer &&
    record.iv.byteLength === 12 &&
    record.cipher instanceof ArrayBuffer &&
    record.cipher.byteLength <= 8 * 1024 * 1024 &&
    Number.isInteger(record.pendingCount) &&
    record.pendingCount >= 0 &&
    record.pendingCount <= 5000
  );
}
async function derive(passphrase, salt) {
  if (!crypto.subtle)
    throw new Error(
      "Cần HTTPS và trình duyệt hỗ trợ mã hóa để dùng ngoại tuyến.",
    );
  if (
    typeof passphrase !== "string" ||
    passphrase.length < 12 ||
    passphrase.length > 256
  )
    throw new Error(
      "Mật khẩu ngoại tuyến cần từ 12 đến 256 ký tự, khác mật khẩu đăng nhập.",
    );
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase.normalize("NFC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export function pendingChanges(task) {
  return task.items
    .filter(
      (item) =>
        item.editable &&
        typeof item.draftCompleted === "boolean" &&
        item.draftCompleted !== item.completed,
    )
    .map((item) => ({ id: item.id, completed: item.draftCompleted }));
}
export function pendingCount(payload) {
  return payload.tasks.reduce(
    (sum, task) => sum + pendingChanges(task).length,
    0,
  );
}
export async function metadata() {
  const record = await transact("readonly", (store) => store.get("active"));
  if (!record) return null;
  if (!validate(record) || record.expiresAt <= Date.now()) {
    await discard();
    return null;
  }
  return {
    ownerId: record.ownerId,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    pendingCount: record.pendingCount,
  };
}
export async function createVault(snapshot, passphrase) {
  if (
    !Array.isArray(snapshot.tasks) ||
    snapshot.tasks.length > 50 ||
    !Number.isSafeInteger(snapshot.ownerId) ||
    snapshot.ownerId < 1 ||
    !Number.isFinite(snapshot.expiresAt) ||
    snapshot.expiresAt <= Date.now()
  )
    throw new Error("Bản chụp không hợp lệ.");
  if (
    !crypto.subtle ||
    typeof passphrase !== "string" ||
    passphrase.length < 12 ||
    passphrase.length > 256
  )
    throw new Error("Cần HTTPS và mật khẩu ngoại tuyến từ 12 đến 256 ký tự.");
  const now = Date.now();
  const record = {
    version: 1,
    vaultId: crypto.randomUUID(),
    ownerId: snapshot.ownerId,
    createdAt: now,
    expiresAt: Math.min(Number(snapshot.expiresAt), now + DAY),
    iterations: ITERATIONS,
    salt: crypto.getRandomValues(new Uint8Array(16)).buffer,
    pendingCount: 0,
  };
  await transact("readwrite", (store) =>
    store.put(record.vaultId, "generation"),
  );
  const key = await derive(passphrase, record.salt);
  const payload = {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => ({
      ...task,
      items: task.items.map((item) => ({
        ...item,
        draftCompleted: !!item.completed,
      })),
    })),
  };
  await saveUnlocked(record, payload, key);
  return {
    ownerId: record.ownerId,
    expiresAt: record.expiresAt,
    pendingCount: 0,
  };
}
export async function unlock(passphrase) {
  const record = await transact("readonly", (store) => store.get("active"));
  if (!validate(record) || record.expiresAt <= Date.now()) {
    await discard();
    throw new Error(
      "Bản ngoại tuyến đã hết hạn hoặc chưa được thiết lập. Hãy vào CareOps khi có mạng để tạo bản mới.",
    );
  }
  const generation = await transact("readonly", (store) =>
    store.get("generation"),
  );
  if (generation !== record.vaultId)
    throw new Error(
      "Bản ngoại tuyến đang được thay thế; hãy thiết lập lại khi có mạng.",
    );
  const key = await derive(passphrase, record.salt);
  let payload;
  try {
    payload = JSON.parse(
      decoder.decode(
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: record.iv,
            additionalData: associated(record),
          },
          key,
          record.cipher,
        ),
      ),
    );
  } catch {
    throw new Error(
      "Mật khẩu ngoại tuyến không đúng hoặc bản lưu không còn nguyên vẹn.",
    );
  }
  if (
    payload.ownerId !== record.ownerId ||
    !Array.isArray(payload.tasks) ||
    payload.tasks.length > 50
  )
    throw new Error("Bản ngoại tuyến không hợp lệ.");
  return { record, payload, key };
}
export async function saveUnlocked(record, payload, key) {
  if (record.expiresAt <= Date.now())
    throw new Error("Bản ngoại tuyến đã hết hạn.");
  record.pendingCount = pendingCount(payload);
  record.iv = crypto.getRandomValues(new Uint8Array(12)).buffer;
  const bytes = encoder.encode(JSON.stringify(payload));
  if (bytes.byteLength > 8 * 1024 * 1024)
    throw new Error("Bản ngoại tuyến vượt giới hạn lưu an toàn.");
  record.cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: record.iv, additionalData: associated(record) },
    key,
    bytes,
  );
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"),
        store = tx.objectStore(STORE),
        check = store.get("generation");
      let cancelled = false;
      check.onsuccess = () => {
        if (check.result !== record.vaultId) {
          cancelled = true;
          tx.abort();
        } else store.put(record, "active");
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () =>
        reject(
          new Error(
            cancelled
              ? "Bản ngoại tuyến đã bị xóa hoặc thay thế. Hãy thiết lập lại."
              : "Không lưu được dữ liệu ngoại tuyến.",
          ),
        );
      tx.onerror = () =>
        reject(new Error("Không lưu được dữ liệu ngoại tuyến."));
    });
  } finally {
    db.close();
  }
}
export async function discard() {
  try {
    await transact("readwrite", (store) => store.clear());
  } finally {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("careops-offline-security");
      channel.postMessage({ type: "discard" });
      channel.close();
    }
  }
}
export function watchDiscard(callback) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel("careops-offline-security");
  channel.onmessage = (event) => {
    if (event.data?.type === "discard") callback();
  };
  return () => channel.close();
}
