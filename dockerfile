############################
# 1) BASE DEPENDENCIES
############################
FROM node:lts-slim AS base

ENV DEBIAN_FRONTEND=noninteractive

# System dependencies for sharp, prisma, ffmpeg, argon2 etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    build-essential \
    python3 \
    ffmpeg \
    git \
    openssl \
    pkg-config \
    libvips-dev \
    libjpeg-dev \
    libpng-dev \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app



############################
# 2) DEPENDENCIES STAGE
############################
FROM base AS deps

# Only package files first (better cache)
COPY package.json ./
COPY pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile || pnpm install



############################
# 3) BUILD STAGE
############################
FROM base AS builder

WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Prisma Client
RUN pnpm exec prisma generate

# Build Astro
RUN pnpm run build



############################
# 4) PRODUCTION RUNTIME
############################
FROM node:lts-slim AS production

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

# Only minimal runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy built app + prod deps only
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 4321

CMD ["node", "dist/server/entry.mjs"]
