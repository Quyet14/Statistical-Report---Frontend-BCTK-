"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { canAccessRoute } from "@/lib/access";
import { useLocale } from "@/i18n/locale-provider";
import {
  CalendarOutlined,
  CheckSquareOutlined,
  ApartmentOutlined,
  InboxOutlined,
  BarChartOutlined,
  RiseOutlined,
  TeamOutlined,
  AppstoreOutlined,
  SettingOutlined,
  DownOutlined,
  ToolOutlined,
  FileProtectOutlined,
} from "@ant-design/icons";

const menuItems = [
  { key: "/checklist", label: "Việc hôm nay", icon: CalendarOutlined },
  {
    key: "/personal-checklist",
    label: "Việc cá nhân",
    icon: CheckSquareOutlined,
  },
  { key: "/tasks", label: "Điều phối việc", icon: ApartmentOutlined },
  { key: "/archive", label: "Lưu trữ", icon: InboxOutlined },
  {
    key: "/workflow",
    label: "Duyệt & công việc lặp lại",
    icon: CheckSquareOutlined,
  },
  {
    key: "/hospital-operations",
    label: "Nghiệp vụ bệnh viện",
    icon: ToolOutlined,
  },
  { key: "/programs", label: "SOP, trực & chất lượng", icon: FileProtectOutlined },
  { key: "/notifications", label: "Trung tâm thông báo", icon: InboxOutlined },
  { key: "/reports", label: "Giao ban", icon: BarChartOutlined },
  { key: "/kpi", label: "KPI", icon: RiseOutlined },
  { key: "/employees", label: "Quản lý nhân viên", icon: TeamOutlined },
  { key: "/departments", label: "Quản lý khoa/phòng", icon: ApartmentOutlined },
  { key: "/organization", label: "Cơ cấu & nhóm", icon: ApartmentOutlined },
    { key: "/settings/operations", label: "Sao lưu & vận hành", icon: SettingOutlined },
];

const menuTranslationKeys: Record<string, Parameters<ReturnType<typeof useLocale>["t"]>[0]> = {
  "/checklist": "nav.today",
  "/personal-checklist": "nav.personal",
  "/tasks": "nav.tasks",
  "/archive": "nav.archive",
  "/workflow": "nav.workflow",
  "/hospital-operations": "nav.hospital",
  "/programs": "nav.programs",
  "/notifications": "nav.notifications",
  "/reports": "nav.reports",
  "/kpi": "nav.kpi",
  "/employees": "nav.employees",
  "/departments": "nav.departments",
  "/organization": "nav.organization",
  "/settings/operations": "nav.settings",
};

const menuGroups = [
  {
    id: "work",
    label: "Công việc",
    icon: AppstoreOutlined,
    keys: [
      "/checklist",
      "/personal-checklist",
      "/tasks",
      "/workflow",
      "/hospital-operations",
      "/programs",
      "/notifications",
      "/archive",
    ],
  },
  {
    id: "management",
    label: "Quản lý",
    icon: SettingOutlined,
    keys: ["/reports", "/kpi", "/employees", "/departments", "/organization", "/settings/operations"],
  },
];

type SidebarPreferences = { collapsed: boolean; closedGroups: string[] };
const preferencesKey = "careops-navigation-v2";

function loadPreferences(): SidebarPreferences {
  if (typeof window === "undefined")
    return { collapsed: false, closedGroups: [] };
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(preferencesKey) ?? "null",
    );
    if (
      saved &&
      typeof saved.collapsed === "boolean" &&
      Array.isArray(saved.closedGroups)
    ) {
      return {
        collapsed: saved.collapsed,
        closedGroups: menuGroups
          .filter((group) => saved.closedGroups.includes(group.id))
          .map((group) => group.id),
      };
    }
  } catch {
    // Use the expanded menu if browser storage is unavailable or invalid.
  }
  return { collapsed: false, closedGroups: [] };
}

export function AppSidebar() {
  const pathname = usePathname();
  const { locale, t } = useLocale();
  const [role, setRole] = useState("staff");
  const [userName, setUserName] = useState("Người dùng");
  const [preferences, setPreferences] = useState<SidebarPreferences>({
    collapsed: false,
    closedGroups: [],
  });
  useEffect(() => {
    const initializationTimer = window.setTimeout(() => {
      setPreferences(loadPreferences());
      const user = getStoredUser();
      setRole(user?.role?.toLowerCase() ?? "staff");
      setUserName(user?.name ?? "Người dùng");
      if (user?.id) {
        void api
          .get<{ name: string }>(`/users/${user.id}`)
          .then((profile) => setUserName(profile.name))
          .catch(() => undefined);
      }
    }, 0);
    return () => window.clearTimeout(initializationTimer);
  }, []);
  const userRole =
    role === "manager"
      ? locale === "en" ? "Department manager" : "Trưởng khoa"
      : role === "leader"
        ? locale === "en" ? "Team leader" : "Trưởng nhóm"
        : role === "viewer"
          ? locale === "en" ? "Read-only" : "Chỉ xem"
          : role === "staff"
            ? locale === "en" ? "Staff" : "Nhân viên"
            : "Admin";
  const visibleItems = menuItems.filter((item) =>
    canAccessRoute(role, item.key),
  );

  const savePreferences = (next: SidebarPreferences) => {
    setPreferences(next);
    try {
      window.localStorage.setItem(preferencesKey, JSON.stringify(next));
    } catch {
      // Interactions remain available without persistent browser storage.
    }
  };

  return (
    <aside
      className={`sidebar-panel${preferences.collapsed ? " is-collapsed" : ""}`}
      aria-label={t("sidebar.menu")}
    >
      <div className="sidebar-brand-row">
        <button
          type="button"
          className="sidebar-brand"
          onClick={() =>
            savePreferences({
              ...preferences,
              collapsed: !preferences.collapsed,
            })
          }
          aria-label={
            preferences.collapsed
              ? `${t("sidebar.expand")} menu HuuNghi CareOps`
              : `${t("sidebar.collapse")} menu HuuNghi CareOps`
          }
          aria-expanded={!preferences.collapsed}
          aria-controls="sidebar-navigation"
          title={
            preferences.collapsed
              ? t("sidebar.expandMenu")
              : t("sidebar.collapseMenu")
          }
        >
          <Image
            className="brand-logo"
            src="/hospital-logo.png"
            alt={t("sidebar.logo")}
            width={42}
            height={42}
            priority
          />
          <span className="sidebar-brand-copy">
            <span className="brand-name">
              HuuNghi <span>CareOps</span>
            </span>
            <span className="brand-subtitle">{t("sidebar.operations")}</span>
          </span>
        </button>
      </div>

      <div className="sidebar-scroll" id="sidebar-navigation">
        <nav
          className="sidebar-menu"
          aria-label={t("sidebar.navigation")}
        >
          {menuGroups.map((group) => {
            const items = visibleItems.filter((item) =>
              group.keys.includes(item.key),
            );
            if (!items.length) return null;
            const isOpen = !preferences.closedGroups.includes(group.id);
            const hasActive = items.some(
              (item) =>
                pathname === item.key || pathname.startsWith(`${item.key}/`),
            );
            return (
              <div
                className={`sidebar-group${hasActive ? " has-active" : ""}`}
                key={group.id}
              >
                <button
                  type="button"
                  className="sidebar-group-title"
                  aria-expanded={isOpen}
                  aria-controls={`sidebar-group-${group.id}`}
                  title={t(group.id === "work" ? "group.work" : "group.management")}
                  aria-label={`${t(isOpen ? "sidebar.collapse" : "sidebar.expand")} ${t(group.id === "work" ? "group.work" : "group.management")}`}
                  onClick={() =>
                    savePreferences({
                      collapsed: false,
                      closedGroups:
                        preferences.collapsed || !isOpen
                          ? preferences.closedGroups.filter(
                              (id) => id !== group.id,
                            )
                          : [...preferences.closedGroups, group.id],
                    })
                  }
                >
                  <group.icon aria-hidden="true" />
                  <span>{t(group.id === "work" ? "group.work" : "group.management")}</span>
                  <DownOutlined
                    className={`sidebar-group-chevron${isOpen ? " is-open" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                <div
                  className="sidebar-group-links"
                  id={`sidebar-group-${group.id}`}
                  hidden={!isOpen}
                >
                  {items.map((item) => {
                    const isActive =
                      pathname === item.key ||
                      pathname.startsWith(`${item.key}/`);

                    return (
                      <Link
                        key={item.key}
                        href={item.key}
                        className={`sidebar-item ${isActive ? "active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={t(menuTranslationKeys[item.key])}
                        title={t(menuTranslationKeys[item.key])}
                      >
                        <item.icon
                          className="sidebar-nav-icon"
                          aria-hidden="true"
                        />
                        <span className="sidebar-item-label">{t(menuTranslationKeys[item.key])}</span>
                        {isActive ? (
                          <span
                            className="sidebar-active-dot"
                            aria-hidden="true"
                          />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      <Link
        href="/account"
        className="sidebar-usercard"
        title={`${locale === "en" ? "View profile" : "Xem hồ sơ"}: ${userName} · ${userRole}`}
        aria-label={`${locale === "en" ? "View account profile" : "Xem hồ sơ tài khoản"} ${userName}`}
      >
        <div className="user-avatar">
          {userName
            .trim()
            .split(/\s+/)
            .slice(-2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </div>
        <div className="sidebar-user-info">
          <div className="user-name" data-i18n-skip>{userName}</div>
          <div className="user-role">{userRole}</div>
        </div>
        <span className="user-icon">◎</span>
      </Link>
    </aside>
  );
}
