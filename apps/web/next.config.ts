import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker: output standalone (trazado desde la raíz del monorepo). Se activa con NEXT_STANDALONE=1
  // (lo setea el Dockerfile); en Windows el copiado con symlinks de pnpm falla sin permisos.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@vedere/ui'],
  // Metadata bloqueante (siempre en <head>) para todos los user agents: generateMetadata usa el
  // mismo fetch cacheado que la página, así que no cuesta nada y Lighthouse/scrapers la ven sin JS.
  htmlLimitedBots: /.+/,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
