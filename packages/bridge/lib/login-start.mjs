/**
 * @file Starting the bridge at login, with no admin rights (docs/16 §4).
 * @description Windows: a scheduled task whose logon trigger and principal are this one user, which a standard user may create, as XML because `schtasks /SC ONLOGON` asks for
 * elevation. If that is refused, the per-user `Run` key does the same job. `conhost --headless` keeps a console window from appearing at login. macOS: a LaunchAgent. Linux: a
 * `systemd --user` unit. `HUB_BRIDGE_SKIP_LOGIN_START=1` is for tests in an isolated home: this is the one step `HOME` cannot isolate.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TASK_NAME = 'HubBridge';
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const LAUNCH_LABEL = 'com.hub.bridge';
/**
 * Written into the task's description. A task without it is from before the repeat, started the bridge once at login and never again, so a bridge that
 * stopped stayed stopped until the next login (2026-11-15). `isLoginStartRegistered` answers false for such a task, so `connect` and the Fix button replace it.
 * r2 repeated on the logon trigger, which Task Scheduler only begins at a logon, so a task written after logging in never repeated that session: r3 repeats
 * on a time trigger from the moment it is written.
 */
export const TASK_REVISION = 'hub-bridge task r3';
/** How often the task looks again. While the bridge it started runs, `IgnoreNew` makes each look nothing; once it has stopped, the next look starts it. */
export const TASK_REPEAT = 'PT2M';

const xmlEscape = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const isSkipped = (system) => system.env.HUB_BRIDGE_SKIP_LOGIN_START === '1';

/** Task Scheduler's own form: local time, no zone, no fraction. */
export function taskTime(date) {
  const two = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

/**
 * Two triggers: the logon starts the bridge at once, and a time trigger from `start` onward looks again every `TASK_REPEAT`, with no end. The time trigger
 * runs only while this user is logged on (`InteractiveToken`), which is when a bridge has anything to do.
 */
export function windowsTaskXml(user, node, script, start = new Date()) {
  const argumentsText = xmlEscape(`--headless "${node}" "${script}" run`);
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Connects this device to Hub, and starts it again if it stops (${TASK_REVISION})</Description></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xmlEscape(user)}</UserId></LogonTrigger><TimeTrigger><Enabled>true</Enabled><StartBoundary>${taskTime(start)}</StartBoundary><Repetition><Interval>${TASK_REPEAT}</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition></TimeTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>${xmlEscape(user)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Hidden>true</Hidden>
  </Settings>
  <Actions Context="Author"><Exec><Command>conhost.exe</Command><Arguments>${argumentsText}</Arguments></Exec></Actions>
</Task>
`;
}

async function registerWindows(system, node, script) {
  const user = system.env.USERDOMAIN
    ? `${system.env.USERDOMAIN}\\${system.env.USERNAME}`
    : (system.env.USERNAME ?? '');
  const file = join(tmpdir(), `hub-bridge-task-${process.pid}.xml`);
  // schtasks reads UTF-16 with a byte order mark.
  writeFileSync(file, Buffer.from(`﻿${windowsTaskXml(user, node, script)}`, 'utf16le'));
  const task = await system.run('schtasks.exe', ['/Create', '/F', '/TN', TASK_NAME, '/XML', file]);
  rmSync(file, { force: true });
  if (task.status === 0) return { ok: true, how: `scheduled task ${TASK_NAME}` };
  const run = await system.run('reg.exe', [
    'add',
    RUN_KEY,
    '/v',
    TASK_NAME,
    '/t',
    'REG_SZ',
    '/f',
    '/d',
    `conhost.exe --headless "${node}" "${script}" run`,
  ]);
  return run.status === 0
    ? { ok: true, how: `the user's Run key (${TASK_NAME})` }
    : { ok: false, how: task.stderr.trim() || run.stderr.trim() || 'schtasks and reg both refused' };
}

const launchAgentPath = (system) => join(system.home, 'Library', 'LaunchAgents', `${LAUNCH_LABEL}.plist`);
const systemdUnitPath = (system) => join(system.home, '.config', 'systemd', 'user', 'hub-bridge.service');

async function registerMac(system, node, script) {
  const path = launchAgentPath(system);
  mkdirSync(join(system.home, 'Library', 'LaunchAgents'), { recursive: true });
  writeFileSync(
    path,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LAUNCH_LABEL}</string>
  <key>ProgramArguments</key><array><string>${xmlEscape(node)}</string><string>${xmlEscape(script)}</string><string>run</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>30</integer>
</dict></plist>
`,
  );
  return { ok: true, how: `LaunchAgent ${LAUNCH_LABEL}` };
}

async function registerLinux(system, node, script) {
  const path = systemdUnitPath(system);
  mkdirSync(join(system.home, '.config', 'systemd', 'user'), { recursive: true });
  writeFileSync(
    path,
    `[Unit]\nDescription=hub-bridge\n\n[Service]\nExecStart="${node}" "${script}" run\nRestart=on-failure\nRestartSec=30\n\n[Install]\nWantedBy=default.target\n`,
  );
  const enabled = await system.run('systemctl', ['--user', 'enable', 'hub-bridge.service']);
  return enabled.status === 0
    ? { ok: true, how: 'systemd --user unit hub-bridge' }
    : { ok: false, how: enabled.stderr.trim() || 'systemctl --user refused' };
}

export async function registerLoginStart(system, node, script) {
  if (isSkipped(system)) return { ok: true, how: 'skipped by HUB_BRIDGE_SKIP_LOGIN_START' };
  if (system.platform === 'win32') return registerWindows(system, node, script);
  if (system.platform === 'darwin') return registerMac(system, node, script);
  return registerLinux(system, node, script);
}

export async function isLoginStartRegistered(system) {
  if (isSkipped(system)) return true;
  if (system.platform === 'win32') {
    const task = await system.run('schtasks.exe', ['/Query', '/TN', TASK_NAME, '/XML'], {
      timeoutMs: 15_000,
    });
    // The XML can come back as UTF-16, so the zero bytes go before looking for the revision.
    if (task.status === 0) return task.stdout.replaceAll('\0', '').includes(TASK_REVISION);
    const run = await system.run('reg.exe', ['query', RUN_KEY, '/v', TASK_NAME], { timeoutMs: 15_000 });
    return run.status === 0;
  }
  return existsSync(system.platform === 'darwin' ? launchAgentPath(system) : systemdUnitPath(system));
}

export async function removeLoginStart(system) {
  if (isSkipped(system)) return;
  if (system.platform === 'win32') {
    await system.run('schtasks.exe', ['/Delete', '/F', '/TN', TASK_NAME]);
    await system.run('reg.exe', ['delete', RUN_KEY, '/v', TASK_NAME, '/f']);
    return;
  }
  if (system.platform === 'darwin') {
    rmSync(launchAgentPath(system), { force: true });
    return;
  }
  await system.run('systemctl', ['--user', 'disable', 'hub-bridge.service']);
  rmSync(systemdUnitPath(system), { force: true });
}
