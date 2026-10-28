export type FeedbackInput = {
  title: string;
  description?: string;
  kind?: "success" | "error" | "info";
  presentation?: "dialog" | "completion";
};

export function taskOutcomeFeedback(previousStatus: string | undefined, nextStatus: string, description?: string, normalTitle = "Đã cập nhật công việc"): FeedbackInput {
  const completed = previousStatus != null && previousStatus !== "done" && nextStatus === "done";
  return { title: completed ? "Hoàn thành công việc!" : normalTitle, description, presentation: completed ? "completion" : "dialog" };
}

export function actionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/\b403\b/.test(message)) return "Bạn không có quyền thực hiện thao tác này.";
  if (/\b401\b/.test(message)) return "Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.";
  return "Chưa lưu được thay đổi. Kiểm tra kết nối và thử lại nhé.";
}

export async function runWithFeedback<T>(
  operation: () => Promise<T>,
  notify: (feedback: FeedbackInput) => void,
  success: FeedbackInput | ((value: T) => FeedbackInput),
): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    const value = await operation();
    notify(typeof success === "function" ? success(value) : success);
    return { ok: true, value };
  } catch (error) {
    notify({ kind: "error", title: "Thao tác chưa thành công", description: actionErrorMessage(error) });
    return { ok: false };
  }
}
