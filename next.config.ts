import type {NextConfig} from 'next';
import path from 'path';

// Correctly import next-pwa
const withPWAImport = require('next-pwa');
const withPWA = withPWAImport({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // You can add more PWA options here if needed
  // E.g., runtimeCaching: require('next-pwa/cache'),
});


const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withPWA(nextConfig);
