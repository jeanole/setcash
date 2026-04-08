/**
 * Global Teardown — Clean up test data after all suites complete
 */

import { execFileSync } from 'child_process';
import path from 'path';

async function globalTeardown() {
  const cleanupScript = path.resolve(__dirname, 'fixtures/cleanup-test-data.ts');
  try {
    execFileSync('npx', ['tsx', cleanupScript], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || process.env.E2E_DATABASE_URL,
      },
    });
  } catch (error) {
    console.error('E2E global teardown failed — test data may remain');
  }
}

export default globalTeardown;
