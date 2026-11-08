/**
 * @file The HubServer logon task through a fake system: the task's XML and arguments, install, state, uninstall. No real task is touched.
 */
import { describe, expect, it } from 'vitest';

import {
  HUB_SERVER_TASK,
  hubServerTaskState,
  hubServerTaskXml,
  installHubServer,
  runHubServerTask,
  taskUser,
  uninstallHubServer,
} from '../lib/hub-server-task.mjs';
import { fakeSystem } from './helpers.mjs';

const PLACES = {
  node: 'C:\\Program Files\\nodejs\\node.exe',
  script: 'F:\\Goteav\\hub & co\\scripts\\hub-server.mjs',
  root: 'F:\\Goteav\\hub & co',
};

describe('the HubServer task', () => {
  it('starts at this user’s logon, asks for no admin rights, keeps one copy and never times out', () => {
    const xml = hubServerTaskXml({ user: 'PC\\me', ...PLACES });
    expect(xml).toContain('<LogonTrigger><Enabled>true</Enabled><UserId>PC\\me</UserId>');
    expect(xml).toContain('<RunLevel>LeastPrivilege</RunLevel>');
    expect(xml).toContain('<LogonType>InteractiveToken</LogonType>');
    expect(xml).toContain('<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>');
    expect(xml).toContain('<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>');
    expect(xml).toContain('<RestartOnFailure><Interval>PT1M</Interval><Count>10</Count></RestartOnFailure>');
    expect(xml).toContain('<Hidden>true</Hidden>');
  });

  it('runs the runner with no window, quoted and escaped, in the repository, and never a build', () => {
    const xml = hubServerTaskXml({ user: 'PC\\me', ...PLACES });
    expect(xml).toContain('<Command>conhost.exe</Command>');
    expect(xml).toContain(
      '<Arguments>--headless &quot;C:\\Program Files\\nodejs\\node.exe&quot; &quot;F:\\Goteav\\hub &amp; co\\scripts\\hub-server.mjs&quot;</Arguments>',
    );
    expect(xml).toContain('<WorkingDirectory>F:\\Goteav\\hub &amp; co</WorkingDirectory>');
    expect(xml).not.toMatch(/\bbuild\b/i);
  });

  it('names the user with their domain when there is one', () => {
    expect(taskUser({ USERDOMAIN: 'PC', USERNAME: 'me' })).toBe('PC\\me');
    expect(taskUser({ USERNAME: 'me' })).toBe('me');
  });

  it('installs through schtasks with the XML file, and reads its state back', async () => {
    const system = fakeSystem();
    system.env.USERDOMAIN = 'PC';
    system.env.USERNAME = 'me';
    const answer = await installHubServer(system, PLACES);
    expect(answer).toEqual({ ok: true, how: `scheduled task ${HUB_SERVER_TASK}` });
    const create = system.calls.find((call) => call.command === 'schtasks.exe' && call.args[0] === '/Create');
    expect(create.args.slice(0, 5)).toEqual(['/Create', '/F', '/TN', 'HubServer', '/XML']);
    expect(create.args[5]).toMatch(/hub-server-task-\d+\.xml$/);
  });

  it('says when schtasks refuses, and changes nothing else', async () => {
    const system = fakeSystem();
    system.taskRefused = true;
    const answer = await installHubServer(system, PLACES);
    expect(answer.ok).toBe(false);
    expect(answer.how).toContain('Access is denied');
    expect(system.calls.some((call) => call.command === 'reg.exe')).toBe(false);
  });

  it('is Windows only: elsewhere it says to use start:local and runs nothing', async () => {
    const system = fakeSystem({ platform: 'linux' });
    const answer = await installHubServer(system, PLACES);
    expect(answer.ok).toBe(false);
    expect(answer.how).toContain('pnpm start:local');
    expect(system.calls).toEqual([]);
  });

  it('touches no task at all with HUB_SERVER_SKIP_TASK', async () => {
    const system = fakeSystem();
    system.env.HUB_SERVER_SKIP_TASK = '1';
    await installHubServer(system, PLACES);
    await uninstallHubServer(system);
    expect(system.calls).toEqual([]);
  });

  it('reads Running from the CSV answer, and not registered from a refusal', async () => {
    const system = fakeSystem();
    const run = system.run;
    system.run = async (command, args, options) => {
      if (command === 'schtasks.exe' && args[0] === '/Query') {
        return { status: 0, stdout: '"\\HubServer","N/A","Running"\r\n', stderr: '' };
      }
      return run(command, args, options);
    };
    expect(await hubServerTaskState(system)).toEqual({ registered: true, status: 'Running' });
    const fresh = fakeSystem();
    expect(await hubServerTaskState(fresh)).toEqual({ registered: false, status: null });
  });

  it('ends the running copy before deleting the task, and runs it on request', async () => {
    const system = fakeSystem();
    await uninstallHubServer(system);
    expect(system.calls.map((call) => call.args[0])).toEqual(['/End', '/Delete']);
    expect((await runHubServerTask(system)).ok).toBe(true);
    expect(system.calls.at(-1).args).toEqual(['/Run', '/TN', 'HubServer']);
  });
});
