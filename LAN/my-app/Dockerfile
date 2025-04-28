# Use Node.js to build the React app
FROM node:18 AS build-stage

# Accept build-time environment variable
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Set working directory
WORKDIR /app

# ✅ Only copy the package files first
COPY package.json package-lock.json ./

# ✅ Install dependencies (this step will be cached if package files don't change)
RUN npm install --legacy-peer-deps

# ✅ Now copy the rest of the app
COPY . .

# ✅ Build with increased memory
RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build


FROM nginx:latest AS production-stage

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Add our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=build-stage /app/build /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

