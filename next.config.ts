
import type {NextConfig} from 'next';
import path from 'path';

// Correctly import next-pwa
const withPWAImport = require('next-pwa');
const withPWA = withPWAImport({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  importScripts: ['/push-worker.js'], // Import our custom push notification handler
});


const nextConfig: NextConfig = {
  // Required for static export to work with Capacitor
  output: 'export',
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withPWA(nextConfig);
