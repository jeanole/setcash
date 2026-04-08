/**
 * Global Setup — Seed test database with known state
 *
 * Runs once before all test suites. Creates test users, projects,
 * categories, motives, bills, and budget matrix entries.
 */

import { execFileSync } from 'child_process';
import path from 'path';

async function globalSetup() {
  const seedScript = path.resolve(__dirname, 'fixtures/seed-test-data.ts');
  try {
    execFileSync('npx', ['tsx', seedScript], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || process.env.E2E_DATABASE_URL,
      },
    });
  } catch (error) {
    console.error('E2E global setup failed — could not seed test data');
    throw error;
  }
}

export default globalSetup;
