import type { NextConfig } from "next";

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
  // Uncomment if you need static export
  // output: 'export',
};

export default nextConfig;

