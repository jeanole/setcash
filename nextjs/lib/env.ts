/**
 * Startup environment variable guard.
 * Import this module early (e.g. in layout.tsx or middleware) so that
 * missing required env vars cause an immediate, descriptive error rather
 * than a cryptic runtime failure deep in the app.
 */

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

function assertEnv(key: RequiredEnvVar): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[SetCash] Missing required environment variable: ${key}\n` +
        `Copy .env.test.example to .env.test (or .env.local) and fill in the value.`
    );
  }
  return value;
}

/**
 * Call this once at startup to validate all required env vars.
 * Throws with a clear message listing every missing variable.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[SetCash] Missing required environment variables:\n` +
        missing.map((k) => `  - ${k}`).join('\n') +
        `\n\nCopy nextjs/.env.test.example to nextjs/.env.test and fill in the values.`
    );
  }
}

export const env = {
  DATABASE_URL: assertEnv('DATABASE_URL'),
  NEXTAUTH_SECRET: assertEnv('NEXTAUTH_SECRET'),
  GOOGLE_CLIENT_ID: assertEnv('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: assertEnv('GOOGLE_CLIENT_SECRET'),
} satisfies Record<RequiredEnvVar, string>;
