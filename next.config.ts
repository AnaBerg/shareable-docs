import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Security invariant: nothing in this app may be framed by another origin.
  // The document list has one-click share-link rotation, so a framing page could clickjack
  // a signed-in owner into revoking live links. The viewer's sandboxed srcdoc
  // iframe is unaffected — srcdoc content is not an HTTP response, so these
  // headers never apply to it. Enforced by src/next-config.test.ts.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
