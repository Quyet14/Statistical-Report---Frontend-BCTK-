const staffRoutes = ["/checklist", "/personal-checklist", "/archive"];
const managerRoutes = [...staffRoutes, "/tasks", "/reports", "/kpi", "/employees"];
const adminRoutes = [...managerRoutes, "/departments", "/settings"];

export function canAccessRoute(role: string, pathname: string) {
  const routes = role.toLowerCase() === "admin" ? adminRoutes : role.toLowerCase() === "manager" ? managerRoutes : staffRoutes;
  return routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
