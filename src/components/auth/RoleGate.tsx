"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getStoredUser } from "@/lib/auth";

type Role = "admin" | "manager" | "staff" | "user";

const allowedRoutes: Record<Role, string[]> = {
  admin: ["/checklist", "/personal-checklist", "/tasks", "/archive", "/reports", "/kpi", "/settings"],
  manager: ["/checklist", "/personal-checklist", "/tasks", "/archive", "/reports", "/kpi"],
  staff: ["/checklist", "/personal-checklist", "/archive"],
  user: ["/checklist", "/personal-checklist", "/archive"],
};

export function RoleGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const role = (getStoredUser()?.role?.toLowerCase() ?? "staff") as Role;
    const routes = allowedRoutes[role] ?? allowedRoutes.staff;
    const allowed = routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

    if (!allowed) router.replace("/checklist");
    else setReady(true);
  }, [pathname, router]);

  return ready ? <>{children}</> : <div className="auth-loading" aria-label="Đang kiểm tra quyền truy cập" />;
}
