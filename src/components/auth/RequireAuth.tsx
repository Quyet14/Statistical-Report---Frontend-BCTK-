"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthRequestError, clearTokens, getStoredToken, refreshCurrentUser } from "@/lib/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();

    if (!token) {
      clearTokens();
      router.replace("/login");
      return;
    }
    window.localStorage.setItem("accessToken", token);
    setHasToken(null);
    setError("");
    void refreshCurrentUser().then(() => {
      if (!cancelled) setHasToken(true);
    }).catch((reason: unknown) => {
      if (cancelled) return;
      if (reason instanceof AuthRequestError && (reason.status === 401 || reason.status === 403)) {
        router.replace("/login");
      } else {
        setError("Không thể xác nhận quyền truy cập. Vui lòng kiểm tra kết nối và thử lại.");
      }
    });
    return () => { cancelled = true; };
  }, [router, retry]);

  if (error) {
    return <div className="auth-panel auth-loading"><div className="auth-card" role="alert"><p>{error}</p><button type="button" className="auth-primary" onClick={() => setRetry((value) => value + 1)}>Thử lại</button></div></div>;
  }

  if (hasToken !== true) {
    return <div className="auth-loading" aria-label="Đang kiểm tra phiên đăng nhập" />;
  }

  return <>{children}</>;
}
