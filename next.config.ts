import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Intercepts local client-side calls
        source: '/api/opensky/:path*',
        // Routes them through the server to bypass browser CORS walls
        destination: 'https://opensky-network.org/api/:path*',
      },
    ];
  },
};

export default nextConfig;