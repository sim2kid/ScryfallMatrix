# Use Node.js as the base image
FROM node:latest AS base

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if it exists)
COPY package.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Environment variables (can be overridden in docker-compose.yml)
ENV PORT=3000
ENV NODE_ENV=production

# Expose the port (if an API is used)
EXPOSE 3000

# Default command
CMD ["npm", "start"]
