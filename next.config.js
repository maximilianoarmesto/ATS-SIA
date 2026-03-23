/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained build artefact under .next/standalone so the
  // Docker runner stage only needs the traced files – not the full node_modules.
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    dirs: ['src', 'prisma'],
  },
}

module.exports = nextConfig