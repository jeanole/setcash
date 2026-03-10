# Stage 1 — deps: install production + dev dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2 — builder: copy source and build the Next.js app
FROM deps AS builder
WORKDIR /app

COPY . .

# Set build-time env vars (values don't matter for build, only for runtime)
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV NEXTAUTH_SECRET=dummy-build-secret-not-for-production-use-only
ENV GOOGLE_CLIENT_ID=dummy-google-client-id
ENV GOOGLE_CLIENT_SECRET=dummy-google-client-secret
ENV SESSION_SECRET=dummy-build-secret-not-for-production-use-only
ENV OCR_ENCRYPTION_SECRET=dummy-build-secret-not-for-production-use-only

# Generate Prisma client before build
RUN npx prisma generate

RUN npm run build

# Compile seed script for production
RUN npx tsc prisma/seed.ts --outDir dist --module commonjs --target es2020 --esModuleInterop --skipLibCheck

# Compile custom server for production
RUN npx tsc --project tsconfig.server.json

# Stage 3 — runner: minimal production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install openssl (required by Prisma schema engine)
RUN apk add --no-cache openssl

# Use non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install production node_modules (includes node-telegram-bot-api + all transitive deps)
COPY --from=builder /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev

# Copy standalone output from builder (overwrites/extends node_modules with Next.js traced deps)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma for migration and seed at startup
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
# Copy compiled seed script
COPY --from=builder --chown=nextjs:nodejs /app/dist/seed.js ./prisma/seed.js

# Copy compiled server and lib (commonjs output from tsconfig.server.json)
COPY --from=builder --chown=nextjs:nodejs /app/dist/server.js ./server.js
COPY --from=builder --chown=nextjs:nodejs /app/dist/lib ./lib

# Create uploads directory with correct ownership before dropping to non-root user
RUN mkdir -p /app/data/uploads && chown nextjs:nodejs /app/data/uploads

ENV UPLOADS_DIR=/app/data/uploads

USER nextjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health 2>/dev/null || exit 1

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node prisma/seed.js && node server.js"]
