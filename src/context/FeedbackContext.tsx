"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckOutlined, CheckCircleFilled, InfoCircleOutlined, CloseOutlined } from "@ant-design/icons";
import { runWithFeedback, type FeedbackInput } from "@/lib/feedback";

type FeedbackItem = FeedbackInput & { id: number };
type FeedbackContextValue = {
  notify: (feedback: FeedbackInput) => void;
  runAction: <T>(operation: () => Promise<T>, success: FeedbackInput | ((value: T) => FeedbackInput)) => Promise<{ ok: true; value: T } | { ok: false }>;
};
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function FeedbackDialog({ item, dismiss }: { item: FeedbackItem; dismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const kind = item.kind ?? "success";
  const isCompletion = item.presentation === "completion" && kind === "success";
  const Icon = kind === "error" ? CloseOutlined : kind === "info" ? InfoCircleOutlined : CheckOutlined;
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  return (
    <dialog ref={dialogRef} className={`completion-dialog feedback-dialog-${kind}`} role={kind === "error" ? "alertdialog" : "dialog"} aria-labelledby="completion-title" aria-describedby="completion-description" onCancel={dismiss}>
      <button type="button" className="feedback-close completion-close" aria-label="Đóng thông báo" onClick={dismiss}><CloseOutlined aria-hidden="true" /></button>
      <div className="completion-art" aria-hidden="true">
        <span className="completion-orbit orbit-a" /><span className="completion-orbit orbit-b" />
        <span className="completion-spark spark-a" /><span className="completion-spark spark-b" />
        <span className="completion-emblem"><Icon /></span>
      </div>
      <span className="completion-kicker">{kind === "error" ? "CHƯA THỂ HOÀN TẤT" : kind === "info" ? "THÔNG BÁO" : isCompletion ? "THÊM MỘT VIỆC ĐÃ HOÀN TẤT" : "THAO TÁC THÀNH CÔNG"}</span>
      <h2 id="completion-title">{item.title}</h2>
      <p id="completion-description">{item.description ?? (kind === "error" ? "Vui lòng kiểm tra lại và thử lại." : "Thông tin đã được cập nhật.")}</p>
      {kind === "success" ? <div className="completion-saved"><CheckCircleFilled aria-hidden="true" /> {isCompletion ? "Đã cập nhật tiến độ" : "Đã lưu thành công"}</div> : null}
      <button type="button" className="completion-continue" onClick={dismiss} autoFocus>{kind === "error" ? "Đã hiểu" : isCompletion ? "Tiếp tục công việc" : "Tiếp tục"}</button>
      {isCompletion ? <span className="completion-footnote">Từng việc hoàn thành, thêm một bước tiến.</span> : null}
    </dialog>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const sequence = useRef(0);
  const [queue, setQueue] = useState<FeedbackItem[]>([]);
  const notify = useCallback((feedback: FeedbackInput) => {
    const item = { ...feedback, id: ++sequence.current };
    setQueue((current) => [...current, item]);
  }, []);
  const dismiss = useCallback(() => setQueue((current) => current.slice(1)), []);
  const runAction = useCallback(<T,>(operation: () => Promise<T>, success: FeedbackInput | ((value: T) => FeedbackInput)) => runWithFeedback(operation, notify, success), [notify]);
  return <FeedbackContext.Provider value={{ notify, runAction }}>
    {children}
    {typeof document !== "undefined" && queue[0] ? createPortal(<FeedbackDialog key={queue[0].id} item={queue[0]} dismiss={dismiss} />, document.body) : null}
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback must be used inside FeedbackProvider");
  return value;
}
