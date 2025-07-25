# Use the latest stable Node.js LTS version for the build stage
FROM node:lts-alpine

# Install necessary build tools for node-gyp, ffmpeg, and OpenSSL
RUN apk add --no-cache python3 make g++ ffmpeg openssl

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if it exists)
COPY package.json ./

# Install dependencies with legacy peer deps to resolve Prisma/Lucia compatibility
RUN npm install --legacy-peer-deps

# Copy the rest of the application source code
COPY . .

# Generate the Prisma client and deploy migrations
RUN npx prisma generate

# Build the Astro site
RUN npm run build

# Expose the port your application will run on
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Command to run the application
CMD ["npm", "run", "production"]
