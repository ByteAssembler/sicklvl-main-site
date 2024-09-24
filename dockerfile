# Use the latest stable Node.js LTS version for the build stage
FROM node:lts-alpine

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

# Log environment variables
RUN echo $DATABASE_URL
RUN echo $HOST
RUN echo $PORT

# Generate the Prisma client and deploy migrations
RUN npx prisma generate
RUN npx prisma migrate dev
RUN npx prisma migrate deploy

# Build the Astro site
RUN npm run build

# Expose the port your application will run on
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321

# Command to run the application
CMD ["npm", "run", "production"]
