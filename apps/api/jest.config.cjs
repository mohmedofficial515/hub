/**
 * @file Unit and architecture tests. Shape copied from F:/Goteav/backend/jest.config.cjs.
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/arch/**/*.spec.ts'],
  transform: { '^.+\\.[tj]s$': ['@swc/jest', { $schema: undefined, sourceMaps: 'inline' }] },
  // jose ships ESM only, so it is compiled for the Jest runtime, as in F:/Goteav/backend.
  transformIgnorePatterns: ['[\\/]node_modules[\\/](?!(\.pnpm[\\/])?jose)'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@hub/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
  setupFiles: ['<rootDir>/test/setup/unit-env.ts'],
  collectCoverageFrom: ['src/modules/**/*.ts', 'src/shared/**/*.ts', '!**/*.spec.ts', '!**/index.ts'],
  coverageDirectory: 'coverage',
  clearMocks: true,
  testTimeout: 15000,
};
