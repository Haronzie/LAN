# Use a secure base image
FROM golang:1.24-alpine3.20

# Install Git and bash (required by wait-for-it.sh)
RUN apk add --no-cache git bash

# Set working directory
WORKDIR /app

# Copy Go mod files first to optimize Docker cache
COPY go.mod go.sum ./
RUN go mod download

# Copy the entire project
COPY . .

# Copy wait-for-it script and make it executable
COPY wait-for-it.sh /wait-for-it.sh
RUN chmod +x /wait-for-it.sh

# Build Go app (assuming main.go is in cmd/server)
RUN go build -o lanfileserver ./cmd/server

# Expose port used by the backend
EXPOSE 8081

# Start the app only after Postgres is ready
CMD ["/wait-for-it.sh", "db:5432", "--timeout=30", "--strict", "--", "./lanfileserver"]
