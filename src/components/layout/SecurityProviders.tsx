"use client";
import { ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { PwaRegistrar } from "./PwaRegistrar";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { UiLocale } from "@/i18n/locale-provider";

export function SecurityProviders({
  nonce,
  initialLocale,
  children,
}: {
  nonce: string;
  initialLocale: UiLocale;
  children: ReactNode;
}) {
  return (
    <ConfigProvider csp={{ nonce }}>
      <LocaleProvider initialLocale={initialLocale}>
        <PwaRegistrar />
        {children}
      </LocaleProvider>
    </ConfigProvider>
  );
}
