"use client";
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, getRequestCooldown } from "@/lib/http";
export function useAuthCooldown() {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    setDeadline(Math.max(getRequestCooldown("auth"), getRequestCooldown("api")));
  }, []);
  useEffect(() => {
    if (deadline <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const capture = useCallback((error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 429) { setNow(Date.now()); setDeadline(error.retryAt); }
  }, []);
  return { seconds, capture };
}
