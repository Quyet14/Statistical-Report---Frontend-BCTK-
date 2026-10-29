"use client";
import { ConfigProvider } from "antd";
import type { ReactNode } from "react";

export function SecurityProviders({ nonce, children }: { nonce: string; children: ReactNode }) {
  return <ConfigProvider csp={{ nonce }}>{children}</ConfigProvider>;
}
