"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.db = void 0;
const client_1 = require("@prisma/client");
const env_1 = require("./env");
// Validate required environment variables before Prisma attempts to connect
(0, env_1.validateEnv)();
// Prevent multiple instances of Prisma Client in development (hot-reload safe)
const globalForPrisma = globalThis;
exports.db = (_a = globalForPrisma.prisma) !== null && _a !== void 0 ? _a : new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
});
// Export prisma as alias for db (for compatibility with existing code)
exports.prisma = exports.db;
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.db;
}
