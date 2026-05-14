/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@usv/core", "@usv/db", "@usv/sdk", "@usv/reconciliation"],
  experimental: { instrumentationHook: true },
  poweredByHeader: false,
  // Lint runs as its own CI step (`pnpm lint`). Don't double-run it during
  // the production build and don't fail builds on style issues that don't
  // affect runtime.
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
