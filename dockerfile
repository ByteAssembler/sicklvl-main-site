# HOW TO BUILD THIS DOCKER IMAGE:
# DATABASE_URL="..." PORT=3000 STORAGE_FOLDER_PATH="/STORAGE/" docker build --build-arg DATABASE_URL="..." -t sicklvl-prod .

############################
# 1) BASE DEPENDENCIES
############################
FROM oven/bun:1.1.29-slim AS base

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
    wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app



############################
# 2) DEPENDENCIES STAGE
############################
FROM base AS deps

# Only package files first (better cache)
COPY package.json ./
COPY bun.lock* ./

RUN bun install



############################
# 3) BUILD STAGE
############################
FROM base AS builder

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# ✅ Prisma Client mit Bun generieren
RUN bunx prisma generate

# ✅ Astro Build mit Bun
RUN bun run build



############################
# 4) PRODUCTION RUNTIME
############################
FROM oven/bun:1.1.29-slim AS production

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# ✅ WICHTIG: node_modules AUS DEM BUILDER (MIT GENERIERTEM PRISMA CLIENT)
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/prisma ./prisma

EXPOSE 4321

# ✅ Server mit Bun starten (kein Node mehr!)
CMD ["bun", "dist/server/entry.mjs"]
