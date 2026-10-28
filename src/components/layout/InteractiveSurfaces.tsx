"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function InteractiveSurfaces({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const motion = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const scrollPanel = root.closest(".dashboard-main");
    let active: HTMLElement | null = null;
    let frame = 0;

    const reset = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      if (!active) return;
      active.classList.remove("surface-active");
      for (const property of ["--surface-rx", "--surface-ry", "--surface-light-x", "--surface-light-y"]) {
        active.style.removeProperty(property);
      }
      active = null;
    };

    const onMove = (event: PointerEvent) => {
      if (!motion.matches || event.pointerType !== "mouse" || event.buttons) return reset();
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest<HTMLElement>(".stat-card, .task-card");
      if (!card || !root.contains(card) || target?.closest("button, a, input, select, textarea, [role='dialog']")) return reset();
      if (active !== card) {
        reset();
        active = card;
      }
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
        card.style.setProperty("--surface-rx", `${(0.5 - y) * 4}deg`);
        card.style.setProperty("--surface-ry", `${(x - 0.5) * 4}deg`);
        card.style.setProperty("--surface-light-x", `${x * 100}%`);
        card.style.setProperty("--surface-light-y", `${y * 100}%`);
        card.classList.add("surface-active");
      });
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerleave", reset);
    root.addEventListener("pointerdown", reset);
    root.addEventListener("pointercancel", reset);
    root.addEventListener("dragstart", reset);
    motion.addEventListener("change", reset);
    scrollPanel?.addEventListener("scroll", reset, { passive: true });
    return () => {
      reset();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", reset);
      root.removeEventListener("pointerdown", reset);
      root.removeEventListener("pointercancel", reset);
      root.removeEventListener("dragstart", reset);
      motion.removeEventListener("change", reset);
      scrollPanel?.removeEventListener("scroll", reset);
    };
  }, []);

  return <div className="dashboard-surfaces" ref={rootRef}>{children}</div>;
}
