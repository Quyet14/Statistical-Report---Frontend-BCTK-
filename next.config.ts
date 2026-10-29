import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CAREOPS_RELEASE === "device" ? ".next-device-release" : ".next",
  poweredByHeader: false,
  allowedDevOrigins: ["192.168.81.178", "192.168.100.6"],
  async redirects() {
    const gateway = process.env.DEV_LOGIN_GATEWAY_ORIGIN;
    if (process.env.NODE_ENV !== "development" || !gateway) return [];
    const target = new URL(gateway);
    if (target.protocol !== "https:" || target.username || target.password || target.pathname !== "/" || target.search || target.hash) {
      throw new Error("DEV_LOGIN_GATEWAY_ORIGIN must be an exact HTTPS origin");
    }
    return ["/", "/login", "/forgot-password"].map(source => ({
      source, destination: `${target.origin}${source}`, permanent: false,
    }));
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }];
  },
};

export default nextConfig;
