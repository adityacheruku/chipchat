
import type {NextConfig} from 'next';
import type { Configuration as WebpackConfig } from 'webpack';

const withPWAImport = require('next-pwa');
const withPWA = withPWAImport({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  importScripts: ['/push-worker.js'], 
});


const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
       {
        protocol: 'https',
        hostname: 'placehold.co',
      }
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config: WebpackConfig, { isServer }) => {
    config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        topLevelAwait: true,
    };
    
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    
    return config;
  },
};

export default withPWA(nextConfig);
