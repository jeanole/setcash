// Load environment variables from .env.test before any tests run.
// This ensures DATABASE_URL and other secrets are available to the Prisma client.
const { loadEnvConfig } = require('@next/env');

module.exports = async function globalSetup() {
  loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });
};
