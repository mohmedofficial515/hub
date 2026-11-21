/**
 * @file `require` hook that compiles TypeScript through SWC with decorator metadata.
 * @description Copied from F:/Goteav/backend/scripts/swc-register.cjs: tsx cannot emit
 * `design:paramtypes`, which Nest DI needs. Usage: `node -r ./scripts/swc-register.cjs scripts/x.ts`.
 */
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('@swc/core');

const root = path.join(__dirname, '..');
const swcrc = JSON.parse(fs.readFileSync(path.join(root, '.swcrc'), 'utf8'));
delete swcrc.$schema;

const options = {
  ...swcrc,
  swcrc: false,
  configFile: false,
  sourceMaps: 'inline',
  module: { type: 'commonjs' },
  jsc: { ...swcrc.jsc, baseUrl: root },
};

function compile(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { code } = transformSync(source, { ...options, filename });
  module._compile(code, filename);
}

require.extensions['.ts'] = compile;
