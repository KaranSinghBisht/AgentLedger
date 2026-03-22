import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "@agentledger/agent-core",
    "ai",
    "@ai-sdk/groq",
    "viem",
    "dotenv",
    "@filoz/synapse-sdk",
    "@modelcontextprotocol/sdk",
  ],
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, "pino-pretty": false };
    config.externals.push("pino-pretty", "encoding");
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
