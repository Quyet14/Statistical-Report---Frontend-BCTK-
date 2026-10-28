import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RoleGate } from "@/components/auth/RoleGate";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TaskProvider } from "@/context/TaskContext";
import { InteractiveSurfaces } from "@/components/layout/InteractiveSurfaces";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RoleGate>
        <TaskProvider>
          <div className="dashboard-shell">
            <AppSidebar />

            <div className="dashboard-main">
              <main className="dashboard-content">
                <div className="page-shell">
                  <AppHeader />
                  <InteractiveSurfaces>{children}</InteractiveSurfaces>
                </div>
              </main>
            </div>
          </div>
        </TaskProvider>
      </RoleGate>
    </RequireAuth>
  );
}
