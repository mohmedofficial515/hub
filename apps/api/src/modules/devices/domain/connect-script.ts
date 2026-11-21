/**
 * @file The one command a new device runs, and the script it fetches (docs/16 §5, D42).
 * @description The command is one line that works unchanged in PowerShell, cmd, bash and zsh: double quotes outside, single quotes inside, and no
 * `$`, `!` or `%`. It needs only Node and Hub's URL. The script downloads the bundle into `~/.hub/app` and hands over to `hub-bridge connect`.
 * Nothing here holds a secret, because this is served without sign-in.
 */
export const CONNECT_ACTIONS = ['connect', 'uninstall'] as const;
export type ConnectAction = (typeof CONNECT_ACTIONS)[number];

export function connectCommand(apiUrl: string, action: ConnectAction = 'connect'): string {
  const query = action === 'connect' ? '' : `?action=${action}`;
  return `node -e "fetch('${apiUrl}/api/v1/connect/bootstrap${query}').then(r=>r.text()).then(s=>eval(s))"`;
}

/** Runs through `eval` inside `node -e`, so `require` is in scope. It validates each path before it writes. */
export function bootstrapScript(apiUrl: string, action: ConnectAction): string {
  return `(async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { spawnSync } = require('node:child_process');
  const url = ${JSON.stringify(apiUrl)};
  const action = ${JSON.stringify(action)};
  const fail = (text) => { process.stderr.write(text + '\\n'); process.exit(1); };
  if (Number(process.versions.node.split('.')[0]) < 22) fail('Hub needs Node 22 or newer. This is ' + process.version + '.');
  const app = path.join(os.homedir(), '.hub', 'app');
  const bin = path.join(app, 'bridge', 'bin', 'hub-bridge.mjs');
  if (action === 'connect') {
    const response = await fetch(url + '/api/v1/connect/bundle');
    if (!response.ok) fail('Hub answered ' + response.status + ' for the bridge files.');
    const bundle = await response.json();
    fs.rmSync(app, { recursive: true, force: true });
    for (const file of bundle.files) {
      if (path.isAbsolute(file.path) || file.path.split('/').includes('..')) fail('Refused a bad path from Hub: ' + file.path);
      const target = path.join(app, ...file.path.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.text);
    }
  } else if (!fs.existsSync(bin)) {
    fail('Nothing to remove: this device has no Hub bridge.');
  }
  const args = action === 'connect' ? ['connect', '--url', url] : ['uninstall'];
  const result = spawnSync(process.execPath, [bin, ...args], { stdio: 'inherit' });
  process.exit(result.status === null ? 1 : result.status);
})().catch((error) => { process.stderr.write(String(error && error.message || error) + '\\n'); process.exit(1); });
`;
}
