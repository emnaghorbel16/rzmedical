FROM node:22-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for tsc)
COPY package*.json ./
RUN npm ci --include=optional

# Copy source files
COPY . .

# Generate Prisma client and build
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

# Production image
FROM node:22-alpine AS runner

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --include=optional

# Copy compiled files and Prisma config
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 4000

# Apply schema (db push handles missing/incomplete migration history)
CMD sh -c "npx prisma db push --schema=prisma/schema.prisma --accept-data-loss && node dist/src/server.js"
