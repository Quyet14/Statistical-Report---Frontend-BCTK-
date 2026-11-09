const staffRoutes = [
  "/checklist",
  "/personal-checklist",
  "/archive",
  "/account",
  "/workflow",
  "/notifications",
  "/hospital-operations",
  "/programs",
];
const managerRoutes = [
  ...staffRoutes,
  "/tasks",
  "/kpi",
  "/employees",
  "/organization",
];
const adminRoutes = [...managerRoutes, "/reports", "/departments", "/settings"];

export function canAccessRoute(role: string, pathname: string) {
  if ((pathname === "/reports/templates" || pathname.startsWith("/reports/templates/")) && role.toLowerCase() !== "admin") return false;
  if((pathname==="/kpi/policies"||pathname.startsWith("/kpi/policies/"))&&!["admin","manager"].includes(role.toLowerCase()))return false;
  if (
    role.toLowerCase() === "manager" &&
    /^\/departments\/[1-9]\d*$/.test(pathname)
  )
    return true;
  const routes =
    role.toLowerCase() === "admin"
      ? adminRoutes
      : role.toLowerCase() === "manager"
        ? managerRoutes
        : role === "leader"
          ? [...staffRoutes, "/tasks", "/kpi", "/organization"]
          : role === "viewer"
            ? [
                "/checklist",
                "/archive",
                "/account",
                "/reports",
                "/kpi",
                "/organization",
                "/notifications",
                "/programs",
              ]
            : role === "staff"
              ? staffRoutes
              : [];
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
