# Use Node.js Alpine Linux image  
FROM node:20-alpine

# Add necessary packages for Prisma
RUN apk add --no-cache libc6-compat openssl

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

# Use development server to avoid build issues
CMD ["npm", "run", "dev"]