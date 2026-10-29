export function contentSecurityPolicy(nonce: string, development: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Existing progress bars and Ant Design positioning use React style attributes.
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:", "font-src 'self' data:",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(!development ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
