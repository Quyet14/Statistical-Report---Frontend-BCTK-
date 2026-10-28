"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { getStoredUser } from "@/lib/auth";
import { canAccessRoute } from "@/lib/access";

export function RoleGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const allowed = canAccessRoute(getStoredUser()?.role ?? "staff", pathname);

  useEffect(() => {
    if (!allowed) router.replace("/checklist");
  }, [allowed, router]);

  return allowed ? <>{children}</> : <div className="auth-loading" aria-label="Đang kiểm tra quyền truy cập" />;
}
