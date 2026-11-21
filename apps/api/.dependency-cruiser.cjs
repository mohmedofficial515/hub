/**
 * @file Architecture rules (docs/11 §2). Adapted from F:/Goteav/backend/.dependency-cruiser.cjs.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'modules-only-via-index',
      severity: 'error',
      comment: 'A module is reachable only through its index.ts.',
      from: { path: '^src/modules/([^/]+)/' },
      to: { path: '^src/modules/(?!$1/)[^/]+/.+', pathNot: '^src/modules/[^/]+/index\\.ts$' },
    },
    {
      name: 'infra-not-to-modules',
      severity: 'error',
      from: { path: '^src/(infra|shared|config)/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'domain-purity',
      severity: 'error',
      comment: 'domain/ imports no framework, ORM or queue.',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: 'node_modules/(@nestjs|@prisma|bullmq|ioredis|pg)/' },
    },
    {
      name: 'mcp-uses-application-only',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/presentation/mcp/' },
      to: { path: '^src/modules/[^/]+/infrastructure/' },
    },
    {
      name: 'application-not-to-infrastructure',
      severity: 'error',
      comment: 'Application services depend on ports; the module file binds the implementation.',
      from: { path: '^src/modules/([^/]+)/application/' },
      to: { path: '^src/modules/$1/(infrastructure|presentation)/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true, dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^src/generated/|\\.spec\\.ts$)' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
