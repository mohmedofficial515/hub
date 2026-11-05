/**
 * @file End-to-end tests: real Postgres and Redis from Testcontainers, migrations applied once.
 * @description Shape copied from F:/Goteav/backend/test/jest-e2e.config.cjs.
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  transform: { '^.+\\.[tj]s$': ['@swc/jest', { $schema: undefined, sourceMaps: 'inline' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@hub/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  globalTeardown: '<rootDir>/test/setup/global-teardown.ts',
  setupFiles: ['<rootDir>/test/setup/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup/per-test-setup.ts'],
  testTimeout: 60000,
  maxWorkers: 1,
  clearMocks: true,
  verbose: true,
};
