// @ts-check
/**
 * @file Root ESLint flat config for the whole monorepo.
 * @description Rule set from docs/11 §6, import ordering adapted from F:/Goteav/backend/eslint.config.mjs.
 * Web rules live in a block here rather than in apps/web so that `eslint .` at the root sees one config.
 */
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

import { noRawPalette } from './tools/eslint/no-raw-palette.mjs';

const moduleInternals = {
  group: ['@/modules/*/*', '@/modules/*/**'],
  message:
    'Import another module only through its index: `@/modules/<name>`. Use relative imports inside it.',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next*/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/node_modules/**',
      'apps/api/src/generated/**',
      'apps/api/openapi/**',
      'apps/web/openapi/**',
      'apps/web/src/lib/api/generated/**',
      '**/next-env.d.ts',
      'docs/**',
      'patches/**',
      // Design versions, copied as they were made. docs/16 §6.
      'apps/lab/**',
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'simple-import-sort': simpleImportSort, 'unused-imports': unusedImports },
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'always'],
      'simple-import-sort/imports': [
        'error',
        { groups: [['^\\u0000'], ['^node:'], ['^@?\\w'], ['^@/'], ['^\\.']] },
      ],
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/modules/**/index.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [moduleInternals] }] },
  },
  {
    files: ['apps/api/src/**/*.spec.ts', 'apps/api/test/**/*.ts', 'apps/api/scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { hub: { rules: { 'no-raw-palette': noRawPalette } } },
    rules: { 'hub/no-raw-palette': 'error' },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: { projectService: false, program: null, project: false },
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly', process: 'readonly' },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'apps/*/scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },
  eslintConfigPrettier,
);
