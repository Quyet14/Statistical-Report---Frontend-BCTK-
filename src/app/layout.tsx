import type { Metadata } from "next";
import "antd/dist/reset.css";
import "./globals.css";
import "./premium.css";
import "./dashboard.css";
import "./feedback.css";
import "./management.css";

export const metadata: Metadata = {
  title: "Việc Pro | Hệ thống quản lý và Vận hành",
  description: "Hệ thống quản lý nhiệm vụ và vận hành Bệnh viện Hữu Nghị",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
