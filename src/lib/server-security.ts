import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
export class SecurityConfigurationError extends Error {}

function origin(value: string, referer = false) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || (!referer && (url.pathname !== "/" || url.search || url.hash))) return null;
    return url.origin;
  } catch { return null; }
}
export function allowedFrontendOrigins() {
  const configured = process.env.FRONTEND_ORIGIN;
  if (configured) {
    const parsed = origin(configured);
    if (!parsed || (process.env.NODE_ENV === "production" && !parsed.startsWith("https://"))) throw new SecurityConfigurationError("FRONTEND_ORIGIN must be an exact HTTPS origin in production");
    return [parsed];
  }
  if (process.env.NODE_ENV === "production") throw new SecurityConfigurationError("Set FRONTEND_ORIGIN in production");
  return ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.100.6:3000", "http://192.168.81.178:3000"];
}
export function verifiedWriteOrigin(headers: Headers) {
  const allowed = allowedFrontendOrigins();
  if (headers.get("sec-fetch-site") === "cross-site") return false;
  // An explicit null/invalid Origin must never fall back to Referer.
  const source = headers.has("origin") ? origin(headers.get("origin") ?? "") : origin(headers.get("referer") ?? "", true);
  return source != null && allowed.includes(source);
}
export function signedClientHeaders(headers: Headers, method: string, target: URL): Record<string, string> {
  if (process.env.NODE_ENV === "production" && process.env.TRUSTED_EDGE_ENABLED !== "true") throw new SecurityConfigurationError("Production requires a trusted edge");
  if (process.env.TRUSTED_EDGE_ENABLED !== "true") return {};
  const edgeKey = process.env.TRUSTED_EDGE_SECRET ?? "";
  const signingKey = process.env.BFF_PROXY_SECRET ?? "";
  if (Buffer.byteLength(edgeKey) < 32 || Buffer.byteLength(signingKey) < 32 || edgeKey === signingKey) throw new SecurityConfigurationError("Configure independent edge/BFF secrets");
  const supplied = Buffer.from(headers.get("x-careops-edge-key") ?? "");
  const expected = Buffer.from(edgeKey);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("Untrusted edge");
  const ip = headers.get("x-careops-client-ip") ?? "";
  if (!isIP(ip)) throw new Error("Invalid client IP");
  const at = String(Date.now());
  const message = JSON.stringify([method, `${target.pathname}${target.search}`, ip, at]);
  return { "X-CareOps-Client-IP": ip, "X-CareOps-Forwarded-At": at, "X-CareOps-Forwarded-Signature": createHmac("sha256", signingKey).update(message).digest("hex") };
}
