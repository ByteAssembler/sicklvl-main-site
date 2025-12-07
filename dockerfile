# Wir nutzen Node 20 (LTS) als Basis. Slim Version für weniger Müll, aber Debian-basiert.
FROM node:20-slim

# Umgebungsvariablen für das System
ENV DEBIAN_FRONTEND=noninteractive

# 1) System-Abhängigkeiten installieren
# Wir behalten die Libs für Sharp, Prisma und FFmpeg bei.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    build-essential \
    python3 \
    ffmpeg \
    git \
    openssl \
    pkg-config \
    # Abhängigkeiten für Bildverarbeitung (Sharp)
    libvips-dev \
    libjpeg-dev \
    libpng-dev \
    wget \
  && rm -rf /var/lib/apt/lists/*

# Arbeitsverzeichnis setzen
WORKDIR /usr/src/app

# 2) Alles kopieren (Single Stage Ansatz)
# Wir kopieren einfach alles sofort rein.
COPY . .

# 3) Abhängigkeiten mit NPM installieren
RUN npm install

# 4) Prisma Client generieren
# Das geht jetzt ohne echte DB-Verbindung, da wir nur die Dateien generieren.
RUN npx prisma generate

# 5) Astro bauen
RUN npm run build

# 6) Runtime Konfiguration
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Port freigeben (Standard Astro/Node Port ist oft 3000 oder 4321, hier auf 3000 genormt)
EXPOSE 3000

# 7) Server starten
# Hier greifen dann deine Environment Variablen aus Coolify (DATABASE_URL etc.)
CMD ["node", "dist/server/entry.mjs"]
