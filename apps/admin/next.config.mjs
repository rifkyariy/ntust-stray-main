/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@stray/ui', 'react-leaflet', '@react-leaflet/core'],
};

export default nextConfig;
