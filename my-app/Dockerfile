# Stage 1: Build the React app
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy only package files first to leverage Docker cache for npm install
COPY package.json package-lock.json ./

# Use npm install instead of npm ci due to lockfile issues
RUN npm install --legacy-peer-deps --prefer-offline --no-audit

# Copy the rest of the application code
COPY . .

# Increase memory limit for large builds (2GB)
ENV NODE_OPTIONS=--max-old-space-size=2048

# Build the production app
RUN npm run build

# Stage 2: Serve the app with NGINX
FROM nginx:stable-alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy custom NGINX config (optional)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the React build from the previous stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
