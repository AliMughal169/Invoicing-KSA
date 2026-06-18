/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@erp/shared-types"],
  async rewrites() {
    // In dev, proxy /api/* to the NestJS backend. Use NEXT_PUBLIC_API_URL when set,
    // otherwise default to localhost:4000 which is the API port defined in apps/api/.env
    const target = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";  //WAS 8001
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};
export default nextConfig;




