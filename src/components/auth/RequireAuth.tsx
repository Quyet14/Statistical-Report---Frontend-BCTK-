"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    const token =
      window.localStorage.getItem("accessToken") ||
      document.cookie
        .split("; ")
        .find((item) => item.startsWith("accessToken="))
        ?.split("=")[1];

    setHasToken(Boolean(token));

    if (!token) {
      router.replace("/login");
    }
  }, [router]);

  if (hasToken !== true) {
    return <div className="auth-loading" aria-label="Đang kiểm tra phiên đăng nhập" />;
  }

  return <>{children}</>;
}
