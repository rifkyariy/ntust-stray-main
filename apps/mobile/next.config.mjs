/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@stray/ui'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async rewrites() {
    const backend = process.env.API_INTERNAL_URL ?? 'http://backend:8000';
    return [
      { source: '/api/backend/:path*', destination: `${backend}/:path*` },
    ];
  },
};

export default nextConfig;
