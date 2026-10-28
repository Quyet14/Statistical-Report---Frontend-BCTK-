"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { canAccessRoute } from "@/lib/access";
import { CalendarOutlined, CheckSquareOutlined, ApartmentOutlined, InboxOutlined, BarChartOutlined, RiseOutlined, TeamOutlined, AppstoreOutlined, SettingOutlined, DownOutlined } from "@ant-design/icons";

const menuItems = [
  { key: "/checklist", label: "Việc hôm nay", icon: CalendarOutlined },
  { key: "/personal-checklist", label: "Việc cá nhân", icon: CheckSquareOutlined },
  { key: "/tasks", label: "Điều phối việc", icon: ApartmentOutlined },
  { key: "/archive", label: "Lưu trữ", icon: InboxOutlined },
  { key: "/reports", label: "Giao ban", icon: BarChartOutlined },
  { key: "/kpi", label: "KPI", icon: RiseOutlined },
  { key: "/employees", label: "Quản lý nhân viên", icon: TeamOutlined },
  { key: "/departments", label: "Quản lý khoa/phòng", icon: ApartmentOutlined },
];

const menuGroups = [
  { id: "work", label: "Công việc", icon: AppstoreOutlined, keys: ["/checklist", "/personal-checklist", "/tasks", "/archive"] },
  { id: "management", label: "Quản lý", icon: SettingOutlined, keys: ["/reports", "/kpi", "/employees", "/departments"] },
];

type SidebarPreferences = { collapsed: boolean; closedGroups: string[] };
const preferencesKey = "careops-navigation-v2";

export function AppSidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState("staff");
  const [userName, setUserName] = useState("Người dùng");
  const [userRole, setUserRole] = useState("User");
  const [preferences, setPreferences] = useState<SidebarPreferences>({ collapsed: false, closedGroups: [] });
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(preferencesKey) ?? "null");
      if (saved && typeof saved.collapsed === "boolean" && Array.isArray(saved.closedGroups)) {
        setPreferences({ collapsed: saved.collapsed, closedGroups: menuGroups.filter((group) => saved.closedGroups.includes(group.id)).map((group) => group.id) });
      }
    } catch {
      // Use the expanded menu if browser storage is unavailable or invalid.
    }
    const user = getStoredUser();
    setRole(user?.role?.toLowerCase() ?? "staff");
    setUserName(user?.name ?? "Người dùng");
    setUserRole(user?.role?.toLowerCase() === "admin" ? "Admin" : user?.role?.toLowerCase() === "manager" ? "Trưởng phòng" : "User");
    if (user?.id) {
      void api.get<{ name: string }>(`/users/${user.id}`).then((profile) => setUserName(profile.name)).catch(() => undefined);
    }
  }, []);
  const visibleItems = menuItems.filter((item) => canAccessRoute(role, item.key));

  const savePreferences = (next: SidebarPreferences) => {
    setPreferences(next);
    try {
      window.localStorage.setItem(preferencesKey, JSON.stringify(next));
    } catch {
      // Interactions remain available without persistent browser storage.
    }
  };

  return (
    <aside className={`sidebar-panel${preferences.collapsed ? " is-collapsed" : ""}`} aria-label="Menu chính">
      <div className="sidebar-brand-row">
      <button type="button" className="sidebar-brand"
        onClick={() => savePreferences({ ...preferences, collapsed: !preferences.collapsed })}
        aria-label={preferences.collapsed ? "Mở rộng menu HuuNghi CareOps" : "Thu gọn menu HuuNghi CareOps"}
        aria-expanded={!preferences.collapsed} aria-controls="sidebar-navigation"
        title={preferences.collapsed ? "Bấm để mở rộng menu" : "Bấm để thu gọn menu"}>
        <Image className="brand-logo" src="/hospital-logo.png" alt="Logo bệnh viện" width={42} height={42} priority />
        <span className="sidebar-brand-copy">
          <span className="brand-name">HuuNghi <span>CareOps</span></span>
          <span className="brand-subtitle">Điều phối vận hành</span>
        </span>
      </button>
      </div>

      <div className="sidebar-scroll" id="sidebar-navigation">

      <nav className="sidebar-menu" aria-label="Điều hướng không gian làm việc">
        {menuGroups.map((group) => {
          const items = visibleItems.filter((item) => group.keys.includes(item.key));
          if (!items.length) return null;
          const isOpen = !preferences.closedGroups.includes(group.id);
          const hasActive = items.some((item) => pathname === item.key);
          return (
            <div className={`sidebar-group${hasActive ? " has-active" : ""}`} key={group.id}>
              <button type="button" className="sidebar-group-title" aria-expanded={isOpen}
                aria-controls={`sidebar-group-${group.id}`} title={group.label} aria-label={`${isOpen ? "Thu gọn" : "Mở rộng"} nhóm ${group.label}`}
                onClick={() => savePreferences({
                  collapsed: false,
                  closedGroups: preferences.collapsed || !isOpen
                    ? preferences.closedGroups.filter((id) => id !== group.id)
                    : [...preferences.closedGroups, group.id],
                })}>
                <group.icon aria-hidden="true" /><span>{group.label}</span>
                <DownOutlined className={`sidebar-group-chevron${isOpen ? " is-open" : ""}`} aria-hidden="true" />
              </button>
              <div className="sidebar-group-links" id={`sidebar-group-${group.id}`} hidden={!isOpen}>
        {items.map((item) => {
          const isActive = pathname === item.key;

          return (
            <Link
              key={item.key}
              href={item.key}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              onClick={(event) => {
                event.preventDefault();
                window.location.href = item.key;
              }}
            >
              <item.icon className="sidebar-nav-icon" aria-hidden="true" />
              <span className="sidebar-item-label">{item.label}</span>
              {isActive ? <span className="sidebar-active-dot" aria-hidden="true" /> : null}
            </Link>
          );
        })}
              </div>
            </div>
          );
        })}
      </nav>

      </div>

      <div className="sidebar-usercard" title={`${userName} · ${userRole}`}>
        <div className="user-avatar">{userName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase()}</div>
        <div className="sidebar-user-info">
          <div className="user-name">{userName}</div>
          <div className="user-role">{userRole}</div>
        </div>
        <span className="user-icon">◎</span>
      </div>
    </aside>
  );
}
