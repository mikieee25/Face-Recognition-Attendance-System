import type { NextConfig } from "next";

const apiOrigin = (
  process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL
)?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // For static export compatibility
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Allow all domains (adjust for production)
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },
  async rewrites() {
    if (!apiOrigin) return [];

    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiOrigin}/uploads/:path*`,
      },
    ];
  },
  // Uncomment if you need static export
  // output: 'export',
};

export default nextConfig;
