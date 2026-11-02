import type { NextConfig } from "next";

const configuredOrigins = [
  process.env.BETTER_AUTH_URL,
  ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
].filter((origin): origin is string => Boolean(origin?.trim()));

const nextConfig: NextConfig = {
  allowedDevOrigins: configuredOrigins.map(
    (origin) => new URL(origin.trim()).hostname,
  ),
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
