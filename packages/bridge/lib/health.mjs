/**
 * @file The health panel's data (docs/16 §5): what `hub doctor` checks, as rows, with a fix from a closed list where Hub can do it.
 * @description No model call. Sign-in is `claude auth status`, and only its `loggedIn` is read: the bridge never opens a credential file (docs/16 §4). Rows carry versions and paths, and the
 * sentences are the page's, by `id`. A copy of Claude Code older than S1 C3's version is reported with the command that updates it, and Hub does not run that command.
 */
import {
  CLAUDE_MIN_VERSION,
  compareVersions,
  inTestedRange,
  meetsMinimum,
  resolveClaude,
  testedMax,
  updateHint,
} from './claude.mjs';
import { installMcpServer, installPlugin, pluginIsInstalled, userServerIsRight } from './install.mjs';
import { isLoginStartRegistered, registerLoginStart } from './login-start.mjs';
import { hubPaths } from './paths.mjs';
import { Refusal } from './protocol.mjs';
import { resolveVsCode } from './vscode.mjs';

const row = (id, ok, detail, extras = {}) => ({
  id,
  ok,
  level: ok ? 'ok' : (extras.level ?? 'error'),
  detail: detail ?? null,
  fix: extras.fix ?? null,
  hint: extras.hint ?? null,
});

export async function signedIn(system, claudePath) {
  const answer = await system.run(claudePath, ['auth', 'status'], { timeoutMs: 20_000 });
  try {
    return JSON.parse(answer.stdout).loggedIn === true;
  } catch {
    return false;
  }
}

export async function runChecks(system, url) {
  const claude = await resolveClaude(system);
  const best = claude.best;
  const checks = [];
  checks.push(
    row('claude_found', Boolean(best), best?.path, {
      hint: best ? null : 'npm install -g @anthropic-ai/claude-code@latest',
    }),
  );
  if (best) {
    const tested = inTestedRange(best.version, system.env);
    checks.push(
      meetsMinimum(best.version) && !tested
        ? // D53: newer than the chat engine has been tested on. It still runs, and the panel says so.
          row('claude_version', false, best.version, {
            level: 'warn',
            hint: `Hub's chat panel is tested up to ${testedMax(system.env)}. It runs with a warning, and the permission rules stay active.`,
          })
        : row('claude_version', meetsMinimum(best.version), best.version, {
            hint: meetsMinimum(best.version) ? null : updateHint(best.path),
          }),
    );
    const onPath = claude.onPath;
    const pathIsOlder = onPath && compareVersions(onPath.version, CLAUDE_MIN_VERSION) < 0;
    checks.push(
      row(
        'claude_path_version',
        !pathIsOlder,
        onPath ? onPath.version : null,
        pathIsOlder ? { level: 'warn', hint: updateHint(onPath.path) } : {},
      ),
    );
    checks.push(
      row('claude_signed_in', await signedIn(system, best.path), null, { hint: 'claude auth login' }),
    );
    const server = userServerIsRight(system, url);
    checks.push(row('mcp_server', server, `${url}/mcp`, server ? {} : { fix: 'mcp_server' }));
    const plugin = await pluginIsInstalled(system, best.path);
    checks.push(row('plugin', plugin, 'hub@hub', plugin ? {} : { fix: 'plugin' }));
  }
  const login = await isLoginStartRegistered(system);
  checks.push(row('login_start', login, null, login ? {} : { fix: 'login_start' }));
  const vscode = await resolveVsCode(system);
  checks.push(row('vscode', vscode.found, vscode.code, vscode.found ? {} : { level: 'warn' }));
  return checks;
}

/** One fix from the closed list. Anything else is refused: a fix name is never a command. */
export async function runFix(system, url, fix) {
  const paths = hubPaths(system);
  if (fix === 'login_start') {
    const done = await registerLoginStart(system, system.nodePath, paths.bridgeBin);
    if (!done.ok) throw new Refusal('failed', done.how);
    return;
  }
  if (fix !== 'mcp_server' && fix !== 'plugin') throw new Refusal('not_fixable');
  const { best } = await resolveClaude(system);
  if (!best) throw new Refusal('failed', 'Claude Code is not installed on this device');
  if (fix === 'mcp_server') await installMcpServer(system, best.path, url);
  else await installPlugin(system, best.path);
}
