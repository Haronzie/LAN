FROM golang:1.24

WORKDIR /app

# Copy go.mod and go.sum first
COPY go.mod go.sum ./
RUN go mod download

# Install LibreOffice
RUN apt-get update && apt-get install -y \
    libreoffice \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the rest of your source code
COPY . .

# (Optional) Make sure all needed deps are added to go.sum
RUN go mod tidy

WORKDIR /app/cmd/server

# Build the Go app
RUN go build -o main .

EXPOSE 8080

CMD ["./main"]
