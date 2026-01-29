FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S appgroup && adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public ./public

# Create data directory with restricted permissions
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data && chmod 700 /app/data

# Switch to non-root user
USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
