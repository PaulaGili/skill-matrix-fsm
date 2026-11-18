import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      // A file from FSM is shown or downloaded, never run as a page of this app.
      { source: "/api/fsm/:path*", headers: [{ key: "Content-Security-Policy", value: "sandbox" }] },
    ];
  },
  turbopack: {
    root: __dirname,
  },
  // UI5 Web Components ship modern ESM that Next has to transpile.
  transpilePackages: [
    "@ui5/webcomponents",
    "@ui5/webcomponents-base",
    "@ui5/webcomponents-fiori",
    "@ui5/webcomponents-icons",
    "@ui5/webcomponents-react",
    "@ui5/webcomponents-react-base",
  ],
};

export default nextConfig;
