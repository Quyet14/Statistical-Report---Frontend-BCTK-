import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { SecurityProviders } from "@/components/layout/SecurityProviders";
import type { UiLocale } from "@/i18n/locale-provider";
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
import "./locale.css";
import "./visual-harmony.css";
import "./interaction-polish.css";
import "./glass-workspace.css";

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
  const savedLocale = (await cookies()).get("locale")?.value;
  const locale: UiLocale = savedLocale === "en" ? "en" : "vi";
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SecurityProviders nonce={nonce} initialLocale={locale}>
          {children}
        </SecurityProviders>
      </body>
    </html>
  );
}
