"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { recordError } from "@/lib/management";

export function useDetailResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ loading: boolean; data: T | null; error: string }>({ loading: true, data: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, data: null, error: "" });
    void load().then((data) => {
      if (!cancelled) setState({ loading: false, data, error: "" });
    }).catch((error: unknown) => {
      if (!cancelled) setState({ loading: false, data: null, error: recordError(error) });
    });
    return () => { cancelled = true; };
  }, [load, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

export function DetailBack({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="detail-back" href={href}><ArrowLeftOutlined aria-hidden="true" />{children}</Link>;
}

export function DetailStatus({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  return <section className="panel-card detail-state" aria-busy={loading}>
    {loading ? <p role="status">Đang tải thông tin...</p> : <div role="alert"><h2>Chưa thể hiển thị thông tin</h2><p>{error}</p><button className="secondary-action" type="button" onClick={retry}><ReloadOutlined aria-hidden="true" /> Thử lại</button></div>}
  </section>;
}
