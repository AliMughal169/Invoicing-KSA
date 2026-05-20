/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@erp/shared-types"],
  async rewrites() {
    // In dev, proxy /api/* to the NestJS backend.
    // In production (Emergent preview URL), the ingress routes /api/* to the backend port directly.
    return [
      { source: "/api/:path*", destination: "http://localhost:8001/api/:path*" },
    ];
  },
};
export default nextConfig;
