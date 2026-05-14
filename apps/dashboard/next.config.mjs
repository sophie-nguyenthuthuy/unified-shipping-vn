/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@usv/core", "@usv/db", "@usv/sdk"],
  experimental: { instrumentationHook: true },
  poweredByHeader: false,
};
export default nextConfig;
