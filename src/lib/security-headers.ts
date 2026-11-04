export function contentSecurityPolicy(options: { dev?: boolean } = {}): string {
  const dev = options.dev === true;
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://image.tmdb.org https://www.themoviedb.org",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws://localhost:* http://localhost:*" : ""}`,
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export interface HeaderPair {
  key: string;
  value: string;
}

export function securityHeaders(options: { dev?: boolean } = {}): HeaderPair[] {
  const dev = options.dev === true;
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy({ dev }) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    ...(dev
      ? []
      : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
  ];
}

export function securityHeadersRecord(options: { dev?: boolean } = {}): Record<string, string> {
  return Object.fromEntries(securityHeaders(options).map((header) => [header.key, header.value]));
}
