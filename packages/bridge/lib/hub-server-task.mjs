/**
 * @file HubServer: Hub itself as a logon task on the main machine (docs/16 "Slice 6 as built", D63), the way `login-start.mjs` starts the bridge.
 * @description A scheduled task whose trigger and principal are this one user, which a standard user may create with no admin rights. It runs
 * `scripts/hub-server.mjs`, which starts the built API, web and lab in production mode and never builds: building is `pnpm hub:service build`,
 * an explicit step. The runner itself restarts a part that stops, because Task Scheduler's "restart on failure" only covers a task that
 * could not launch; the task's own restart setting is kept for that case. `conhost --headless` keeps a console window from appearing.
 * Windows only: on another system `install` says so and changes nothing. Everything runs through `system.run`, so tests touch no real task.
 */
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const HUB_SERVER_TASK = 'HubServer';
/** A minute's wait after logon, so Docker Desktop has started before the runner asks it for Postgres. */
const LOGON_DELAY = 'PT1M';

const xmlEscape = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function taskUser(env) {
  return env.USERDOMAIN ? `${env.USERDOMAIN}\\${env.USERNAME}` : (env.USERNAME ?? '');
}

/** The task: at this user's logon, no elevation, one copy, no time limit, hidden, started in the repository. */
export function hubServerTaskXml({ user, node, script, root }) {
  const argumentsText = xmlEscape(`--headless "${node}" "${script}"`);
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Runs Hub on this machine at logon (pnpm hub:service)</Description></RegistrationInfo>
  <Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${xmlEscape(user)}</UserId><Delay>${LOGON_DELAY}</Delay></LogonTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>${xmlEscape(user)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure><Interval>PT1M</Interval><Count>10</Count></RestartOnFailure>
    <Hidden>true</Hidden>
  </Settings>
  <Actions Context="Author"><Exec><Command>conhost.exe</Command><Arguments>${argumentsText}</Arguments><WorkingDirectory>${xmlEscape(root)}</WorkingDirectory></Exec></Actions>
</Task>
`;
}

/** Writes the task. Windows only, and never in a test home: `HUB_SERVER_SKIP_TASK=1` is the switch. */
export async function installHubServer(system, { node, script, root }) {
  if (system.env.HUB_SERVER_SKIP_TASK === '1') return { ok: true, how: 'skipped by HUB_SERVER_SKIP_TASK' };
  if (system.platform !== 'win32') {
    return {
      ok: false,
      how: 'HubServer is a Windows scheduled task. On this system, run `pnpm start:local`.',
    };
  }
  const file = join(tmpdir(), `hub-server-task-${process.pid}.xml`);
  // schtasks reads UTF-16 with a byte order mark.
  writeFileSync(
    file,
    Buffer.from(`﻿${hubServerTaskXml({ user: taskUser(system.env), node, script, root })}`, 'utf16le'),
  );
  const task = await system.run('schtasks.exe', ['/Create', '/F', '/TN', HUB_SERVER_TASK, '/XML', file]);
  rmSync(file, { force: true });
  return task.status === 0
    ? { ok: true, how: `scheduled task ${HUB_SERVER_TASK}` }
    : { ok: false, how: task.stderr.trim() || 'schtasks refused' };
}

export async function uninstallHubServer(system) {
  if (system.env.HUB_SERVER_SKIP_TASK === '1') return { ok: true };
  if (system.platform !== 'win32') return { ok: true };
  await system.run('schtasks.exe', ['/End', '/TN', HUB_SERVER_TASK]);
  const removed = await system.run('schtasks.exe', ['/Delete', '/F', '/TN', HUB_SERVER_TASK]);
  return { ok: removed.status === 0 };
}

/** `registered` and the task's own status word (Ready, Running, Disabled), read from `schtasks /Query /FO CSV`. */
export async function hubServerTaskState(system) {
  if (system.platform !== 'win32') return { registered: false, status: null };
  const query = await system.run('schtasks.exe', ['/Query', '/TN', HUB_SERVER_TASK, '/FO', 'CSV', '/NH'], {
    timeoutMs: 15_000,
  });
  if (query.status !== 0) return { registered: false, status: null };
  const fields = [...(query.stdout.trim().split(/\r?\n/)[0] ?? '').matchAll(/"([^"]*)"/g)].map(
    (match) => match[1],
  );
  return { registered: true, status: fields[2] || null };
}

/** Starts the task now, as a logon would. */
export async function runHubServerTask(system) {
  const run = await system.run('schtasks.exe', ['/Run', '/TN', HUB_SERVER_TASK]);
  return { ok: run.status === 0, how: run.stderr.trim() };
}
