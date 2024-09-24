# Use the latest stable Node.js LTS version for the build stage
FROM node:lts-alpine AS build

# Install necessary build tools for node-gyp
RUN apk add --no-cache python3 make g++

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if it exists)
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Set the DATABASE_URL for Prisma (SQLite example)
ENV DATABASE_URL="file:./database.db"

# Generate the Prisma client and deploy migrations
RUN npx prisma generate
RUN npx prisma migrate deploy

# Build the Astro site
RUN npm run build

# Use a minimal image for production
FROM node:lts-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy the built site from the build stage
COPY --from=build /usr/src/app/ /usr/src/app/

# Install only production dependencies
RUN npm install --only=production

# Expose the prisma database file path
ENV DATABASE_URL="file:./database.db"

# Expose the port your application will run on
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Command to run the application
CMD ["npm", "run", "production"]
