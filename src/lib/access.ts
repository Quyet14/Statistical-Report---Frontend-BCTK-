const staffRoutes = ["/checklist", "/personal-checklist", "/archive", "/account"];
const managerRoutes = [...staffRoutes, "/tasks", "/kpi", "/employees"];
const adminRoutes = [...managerRoutes, "/reports", "/departments", "/settings"];

export function canAccessRoute(role: string, pathname: string) {
  if (role.toLowerCase() === "manager" && /^\/departments\/[1-9]\d*$/.test(pathname)) return true;
  const routes = role.toLowerCase() === "admin" ? adminRoutes : role.toLowerCase() === "manager" ? managerRoutes : staffRoutes;
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
