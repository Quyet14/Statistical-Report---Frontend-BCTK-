"use client";
import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { PwaRegistrar } from "./PwaRegistrar";

export function SecurityProviders({ nonce, children }: { nonce: string; children: ReactNode }) {
  return <ConfigProvider csp={{ nonce }}><PwaRegistrar />{children}</ConfigProvider>;
}
