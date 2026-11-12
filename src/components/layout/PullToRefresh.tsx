"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const threshold = 68;

export function PullToRefresh({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pathname = usePathname();

  useEffect(() => { dirtyRef.current = false; }, [pathname]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let start: { x: number; y: number } | null = null;
    let pull = 0;
    let busy = false;
    let activePointer: number | null = null;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const atTop = () => container.scrollTop <= 1 && window.scrollY <= 1;
    const cancel = () => { start = null; activePointer = null; pull = 0; if (!busy) setDistance(0); };
    const begin = (target: EventTarget | null, x: number, y: number) => {
      if (busy || !atTop() || !(target instanceof Element)) return false;
      if (document.querySelector('[aria-modal="true"], .modal-backdrop, .management-dialog-backdrop')) return false;
      if (target.closest('input, textarea, select, button, a, [contenteditable="true"], [draggable="true"]')) return false;
      for (let node: Element | null = target; node && node !== container; node = node.parentElement) {
        if (node.scrollHeight > node.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return false;
      }
      start = { x, y };
      return true;
    };
    const onStart = (event: TouchEvent) => {
      if (event.touches.length === 1) begin(event.target, event.touches[0].clientX, event.touches[0].clientY);
    };
    const move = (x: number, y: number) => {
      if (!start || busy) return false;
      if (!atTop()) { cancel(); return false; }
      const dy = y - start.y;
      const dx = Math.abs(x - start.x);
      if (dy <= 0 || (dx > 12 && dx > dy)) { cancel(); return false; }
      if (dy < 10) return false;
      pull = Math.min(96, dy * 0.45);
      setDistance(pull);
      return true;
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) { cancel(); return; }
      if (move(event.touches[0].clientX, event.touches[0].clientY) && event.cancelable) event.preventDefault();
    };
    const onEnd = () => {
      if (!start || busy) return;
      const ready = pull >= threshold;
      cancel();
      if (!ready || !navigator.onLine) return;
      if (dirtyRef.current && !window.confirm("Có nội dung chưa lưu. Bạn muốn tải lại trang?")) return;
      busy = true;
      setDistance(threshold);
      setRefreshing(true);
      reloadTimer = setTimeout(() => window.location.reload(), 180);
    };
    const onPointerStart = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
      if (event.target instanceof Element && event.target.closest('p, h1, h2, h3, h4, span, strong, label')) return;
      if (window.getSelection()?.isCollapsed === false) return;
      if (begin(event.target, event.clientX, event.clientY)) {
        activePointer = event.pointerId;
        container.setPointerCapture(event.pointerId);
        event.preventDefault();
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (activePointer !== event.pointerId) return;
      if (!event.buttons) { cancel(); return; }
      if (move(event.clientX, event.clientY)) event.preventDefault();
    };
    const onPointerEnd = (event: PointerEvent) => {
      if (activePointer === event.pointerId) onEnd();
    };
    const onPointerCancel = (event: PointerEvent) => { if (activePointer === event.pointerId) cancel(); };
    const onInput = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('form')) dirtyRef.current = true;
    };
    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onEnd, { passive: true });
    container.addEventListener('touchcancel', cancel, { passive: true });
    container.addEventListener('pointerdown', onPointerStart);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerEnd);
    container.addEventListener('pointercancel', onPointerCancel);
    container.addEventListener('lostpointercapture', onPointerCancel);
    container.addEventListener('input', onInput, true);
    container.addEventListener('change', onInput, true);
    return () => {
      clearTimeout(reloadTimer);
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onEnd);
      container.removeEventListener('touchcancel', cancel);
      container.removeEventListener('pointerdown', onPointerStart);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerEnd);
      container.removeEventListener('pointercancel', onPointerCancel);
      container.removeEventListener('lostpointercapture', onPointerCancel);
      container.removeEventListener('input', onInput, true);
      container.removeEventListener('change', onInput, true);
    };
  }, []);

  const visible = distance > 8;
  return (
    <div className="dashboard-main pull-refresh-container" ref={containerRef}>
      <div className="pull-refresh-anchor">
        <div className={`pull-refresh-indicator${refreshing ? " is-refreshing" : ""}`} data-active={visible} style={{ transform: `translate(-50%, ${distance - 48}px)` }} role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 7v5h-5" /><path d="M19.4 12a7.5 7.5 0 1 0-1.5 4.5" /></svg>
          <span>{visible ? refreshing ? "Đang tải lại…" : distance >= threshold ? "Thả để tải lại" : "Kéo xuống để tải lại" : ""}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
