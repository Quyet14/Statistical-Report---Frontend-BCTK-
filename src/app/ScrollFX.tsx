"use client";
import { useEffect, useRef } from "react";
import s from "./welcome.module.css";

export default function ScrollFX() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const main = document.querySelector("main") as HTMLElement | null;
    const onScroll = (e: Event) => {
      const el = e.target instanceof HTMLElement ? e.target : document.documentElement;
      const p = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
      bar.current?.style.setProperty("--p", String(Math.min(1, Math.max(0, p))));
    };
    const onMove = (e: MouseEvent) => {
      main?.style.setProperty("--mx", String(e.clientX / window.innerWidth - 0.5));
      main?.style.setProperty("--my", String(e.clientY / window.innerHeight - 0.5));
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);
  return <div ref={bar} className={s.progress} aria-hidden="true" />;
}