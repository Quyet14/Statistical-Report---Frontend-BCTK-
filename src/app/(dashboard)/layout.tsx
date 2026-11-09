import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RoleGate } from "@/components/auth/RoleGate";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TaskProvider } from "@/context/TaskContext";
import { InteractiveSurfaces } from "@/components/layout/InteractiveSurfaces";
import { FeedbackProvider } from "@/context/FeedbackContext";
import { GalaxyBackdrop } from "@/components/layout/GalaxyBackdrop";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RoleGate>
        <FeedbackProvider>
        <TaskProvider>
          <div className="dashboard-shell">
            <GalaxyBackdrop />
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
        </FeedbackProvider>
      </RoleGate>
    </RequireAuth>
  );
}
