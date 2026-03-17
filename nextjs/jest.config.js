/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        skipLibCheck: true,
      },
    }],
    // Transform ESM-only node_modules (next-auth, @auth/core, jose, etc.)
    '^.+\\.js$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        skipLibCheck: true,
        allowJs: true,
      },
    }],
  },
  // Don't skip transforming ESM-only packages
  transformIgnorePatterns: [
    '/node_modules/(?!(next-auth|@auth|oauth4webapi|jose|@panva|@noble|preact|cookie)/).*',
  ],
  testTimeout: 30000,
};

module.exports = config;
