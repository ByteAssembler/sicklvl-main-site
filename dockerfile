# Use the latest stable Node.js LTS version for the build stage
FROM node:lts-alpine AS build

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if it exists)
# COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the Astro site
RUN npm run build

# Use a minimal image for production
FROM node:lts-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy the built site from the build stage
COPY --from=build /usr/src/app/ /usr/src/app/

# Install only production dependencies
RUN npm ci --omit=dev

# Expose the port your application will run on
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Command to run the application
CMD ["npm", "run", "production"]
