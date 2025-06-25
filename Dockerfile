# Use Node.js Alpine Linux image  
FROM node:20-alpine

# Add necessary packages for Prisma and database tools
RUN apk add --no-cache libc6-compat openssl postgresql-client

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client for the correct platform
RUN npx prisma generate

# Set environment variables
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

# Create a startup script to handle database migration and startup
COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Use startup script
CMD ["/usr/local/bin/start.sh"]