# =============================================================================
# ATS – SIA  |  Dockerfile
#
# Multi-stage build:
#   1. deps    – install production + dev dependencies
#   2. builder – generate Prisma client and produce a Next.js standalone build
#   3. runner  – minimal production image (only the standalone artefact)
#
# Environment variables
# ─────────────────────
# DATABASE_URL   (required at runtime)
#   PostgreSQL connection string consumed by Prisma.
#   Supply it via `docker run -e DATABASE_URL=...` or an orchestrator secret.
#   Example: postgresql://user:password@db:5432/ats_sia_db
#
# NODE_ENV       (default: production)
#   Controls Next.js behaviour (minification, error overlays, etc.).
#
# PORT           (default: 3000)
#   Port the Next.js server listens on inside the container.
#
# HOSTNAME       (default: 0.0.0.0)
#   Interface the Next.js server binds to. Must be 0.0.0.0 so requests
#   reach the container from outside.
# =============================================================================

# ── Base image ────────────────────────────────────────────────────────────────
# node:20-alpine is smaller than the debian variants while still satisfying
# the project's engine requirement of Node >= 18.
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS base

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – deps
# Install ALL dependencies (including devDependencies needed for the build).
# Keeping this in its own layer lets Docker cache it as long as package-lock
# doesn't change.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS deps

# libc6-compat is required by some native Node modules on Alpine.
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy manifests first so layer caching is invalidated only when they change.
COPY package.json package-lock.json ./

# Install all dependencies (ci = clean, reproducible install from lock file).
RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – builder
# Generate the Prisma client and compile the Next.js production build.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

# Bring in node_modules from the deps stage.
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source tree.
COPY . .

# Generate the Prisma client from the schema so @prisma/client is available
# at build time (required by Next.js server components that import prisma.ts).
RUN npx prisma generate

# Build the Next.js application.
# output: 'standalone' in next.config.js produces .next/standalone – a
# self-contained server that doesn't need the full node_modules at runtime.
#
# NEXT_TELEMETRY_DISABLED=1 prevents Next.js from phoning home during builds.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – runner
# Minimal production image: copy only the standalone output and static assets.
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS runner

# Disable Next.js telemetry in production containers.
ENV NEXT_TELEMETRY_DISABLED=1

# Default runtime environment.
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Run as a non-root user for better security.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone server bundle produced by the builder stage.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets (CSS, JS chunks, fonts, media) required by the server.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the public directory (favicon, SVGs, etc.).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to the non-root user before starting the process.
USER nextjs

# Expose the port the application listens on.
EXPOSE 3000

# DATABASE_URL must be provided at runtime; the build intentionally leaves it
# unset so secrets are never baked into the image layer.
# Example:
#   docker run -e DATABASE_URL="postgresql://user:pass@db:5432/ats_sia_db" ...
#
# Start the standalone Next.js server.
CMD ["node", "server.js"]
