import type { Metadata } from "next";
import { headers } from "next/headers";
import { SecurityProviders } from "@/components/layout/SecurityProviders";
import "antd/dist/reset.css";
import "./globals.css";
import "./premium.css";
import "./dashboard.css";
import "./feedback.css";
import "./management.css";
import "./workflow.css";
import "./task-dependencies.css";
import "./organization.css";
import "./kpi-policy.css";
import "./hospital-operations.css";
import "./galaxy.css";
import "./coordination.css";
import "./collaboration.css";
import "./role-dashboard.css";
import "./workspace-polish.css";

export const metadata: Metadata = {
  title: "Việc Pro | Hệ thống quản lý và Vận hành",
  description: "Hệ thống quản lý nhiệm vụ và vận hành Bệnh viện Hữu Nghị",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "CareOps", statusBarStyle: "default" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SecurityProviders nonce={nonce}>{children}</SecurityProviders>
      </body>
    </html>
  );
}
