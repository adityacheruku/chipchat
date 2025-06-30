
import type {NextConfig} from 'next';
import type { Configuration as WebpackConfig } from 'webpack';

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
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config: WebpackConfig, { isServer }) => {
    // Stub out Node.js modules that shouldn't be bundled for the client
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    
    // Required for ffmpeg to work correctly with async WASM
    config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        topLevelAwait: true, // Helpful for some modern libraries
    };
    
    return config;
  },
};

export default withPWA(nextConfig);
