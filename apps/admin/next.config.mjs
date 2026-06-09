/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@stray/ui', 'react-leaflet', '@react-leaflet/core'],

  // Same-origin API proxy: the browser talks only to the admin origin, and
  // Next forwards to the internal services over the Docker network. This avoids
  // CORS, host/port guessing, and NEXT_PUBLIC_* build-time inlining entirely.
  // Destinations resolve at build time, so they use the stable Docker service
  // names (overridable via env for non-Docker dev).
  async rewrites() {
    const detector = process.env.DETECTOR_INTERNAL_URL ?? 'http://detector:8001';
    const backend  = process.env.API_INTERNAL_URL ?? 'http://backend:8000';
    return [
      { source: '/detector/:path*',    destination: `${detector}/:path*` },
      { source: '/api/backend/:path*', destination: `${backend}/:path*` },
    ];
  },
};

export default nextConfig;
