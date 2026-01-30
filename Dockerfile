FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Create non-root user
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

COPY server.js ./
COPY public ./public

# Create data directory with restricted permissions
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data && chmod 700 /app/data

# Switch to non-root user
USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
