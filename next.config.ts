import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Use Turbopack configuration instead of webpack
  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  // Optimize for development speed
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      maxInactiveAge: 60 * 60 * 1000, // Keep pages in memory for 1 hour
      pagesBufferLength: 5,           // Keep more pages in memory
    },
  }),
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
