"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthRequestError, refreshCurrentUser } from "@/lib/auth";
import { useAuthCooldown } from "./useAuthCooldown";
import { SessionActivity } from "./SessionActivity";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const cooldown = useAuthCooldown();

  useEffect(() => {
    let cancelled = false;
    setHasToken(null);
    setError("");
    void refreshCurrentUser().then(() => {
      if (!cancelled) setHasToken(true);
    }).catch((reason: unknown) => {
      if (cancelled) return;
      cooldown.capture(reason);
      if (reason instanceof AuthRequestError && reason.status === 401) {
        router.replace("/login");
      } else {
        setError(reason instanceof AuthRequestError && reason.status === 403 ? "Bạn không có quyền truy cập nội dung này. Phiên đăng nhập vẫn được giữ nguyên." : "Không thể xác nhận quyền truy cập. Vui lòng kiểm tra kết nối và thử lại.");
      }
    });
    return () => { cancelled = true; };
  }, [router, retry]);

  if (error) {
    return <div className="auth-panel auth-loading"><div className="auth-card" role="alert"><p>{error}</p><button type="button" disabled={cooldown.seconds > 0} className="auth-primary" onClick={() => setRetry((value) => value + 1)}>{cooldown.seconds > 0 ? `Thử lại sau ${cooldown.seconds}s` : "Thử lại"}</button></div></div>;
  }

  if (hasToken !== true) {
    return <div className="auth-loading" aria-label="Đang kiểm tra phiên đăng nhập" />;
  }

  return <><SessionActivity />{children}</>;
}
