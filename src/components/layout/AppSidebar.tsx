"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/auth";
import { api } from "@/lib/api";

const menuItems = [
  { key: "/checklist", label: "Việc hôm nay" },
  { key: "/personal-checklist", label: "Việc cá nhân" },
  { key: "/tasks", label: "Điều phối việc" },
  { key: "/archive", label: "Lưu trữ" },
  { key: "/reports", label: "Giao ban" },
  { key: "/kpi", label: "KPI" },
  { key: "/settings", label: "Nhân sự/phòng ban" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState("staff");
  const [userName, setUserName] = useState("Người dùng");
  const [userRole, setUserRole] = useState("User");
  useEffect(() => {
    const user = getStoredUser();
    setRole(user?.role?.toLowerCase() ?? "staff");
    setUserName(user?.name ?? "Người dùng");
    setUserRole(user?.role?.toLowerCase() === "admin" ? "Admin" : user?.role?.toLowerCase() === "manager" ? "Trưởng phòng" : "User");
    if (user?.id) {
      void api.get<{ name: string }>(`/users/${user.id}`).then((profile) => setUserName(profile.name)).catch(() => undefined);
    }
  }, []);
  const visibleItems = menuItems.filter((item) => {
    if (role === "admin") return true;
    if (role === "manager") return ["/checklist", "/personal-checklist", "/tasks", "/archive", "/reports", "/kpi"].includes(item.key);
    return ["/checklist", "/personal-checklist", "/archive"].includes(item.key);
  });

  return (
    <aside className="sidebar-panel">
      <Link href="/checklist" className="sidebar-brand" onClick={(event) => {
        event.preventDefault();
        window.location.href = "/checklist";
      }}>
        <Image className="brand-logo" src="/hospital-logo.png" alt="Logo bệnh viện" width={42} height={42} priority />
        <div>
          <div className="brand-name">HuuNghi CareOps</div>
          <span className="brand-subtitle">Điều phối vận hành bệnh viện</span>
        </div>
      </Link>

      <div className="sidebar-section-header">Không gian làm việc</div>

      <nav className="sidebar-menu" aria-label="Sidebar navigation">
        {visibleItems.map((item) => {
          const isActive = pathname === item.key;

          return (
            <Link
              key={item.key}
              href={item.key}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={(event) => {
                event.preventDefault();
                window.location.href = item.key;
              }}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-usercard">
        <div className="user-avatar">TL</div>
        <div>
          <div className="user-name">{userName}</div>
          <div className="user-role">{userRole}</div>
        </div>
        <span className="user-icon">◎</span>
      </div>
    </aside>
  );
}
