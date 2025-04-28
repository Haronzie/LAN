# Use the official Go image as the base image
FROM golang:1.24

# Set working directory
WORKDIR /app

# Copy go.mod and go.sum first
COPY go.mod go.sum ./

# Download Go modules
RUN go mod download

# Copy the rest of the source code
COPY . .

# Move to the server directory
WORKDIR /app/cmd/server

# List files to debug
RUN ls -la

# Build the Go app
RUN go build -o main .

# Expose port
EXPOSE 8080

# Command to run
CMD ["./main"]
