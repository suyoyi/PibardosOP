import type { NextConfig } from "next";

const codespaceName = process.env.CODESPACE_NAME;
const forwardingDomain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
const codespaceHost =
  codespaceName &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(codespaceName) &&
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(
    forwardingDomain,
  )
    ? `${codespaceName}-3000.${forwardingDomain}`
    : undefined;

const config: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: codespaceHost ? [codespaceHost] : undefined,
  experimental: codespaceHost
    ? {
        serverActions: { allowedOrigins: [codespaceHost] },
      }
    : undefined,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};
export default config;
