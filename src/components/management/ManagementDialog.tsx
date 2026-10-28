"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CloseOutlined } from "@ant-design/icons";

export function ManagementDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className="management-dialog" aria-labelledby="management-dialog-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="management-dialog-header"><h2 id="management-dialog-title">{title}</h2><button type="button" className="feedback-close" aria-label="Đóng cửa sổ" disabled={busy} onClick={onClose}><CloseOutlined aria-hidden="true" /></button></div>
    {children}
  </dialog>;
}
