/**
 * @file Handlers of the device tools. They call the same service as Settings › Devices.
 * @description There is no pairing tool and no Link tool: pairing makes credentials, and D44 allows the trust write only on the owner's press.
 * No answer holds a credential.
 */
import type { DeviceDto, Principal } from '@hub/contracts';

import type { ToolHandlers } from '../tool-context';

function renderHealth(device: DeviceDto): string[] {
  if (device.health.length === 0) return ['No health report yet.'];
  return device.health.map((check) => {
    const mark = check.level === 'ok' ? 'ok' : check.level;
    const extra = [check.detail, check.hint, check.fix ? `fix_device can run \`${check.fix}\`` : null]
      .filter(Boolean)
      .join(' · ');
    return `- ${check.id}: ${mark}${extra ? ` (${extra})` : ''}`;
  });
}

function renderDevice(device: DeviceDto): string {
  return [
    `${device.name} (\`${device.id}\`): ${device.online ? 'online' : 'offline'}, ${device.platform}, Claude Code ${device.claudeVersion ?? 'unknown'}`,
    ...renderHealth(device),
  ].join('\n');
}

/** A device tool reaches a member's own devices, whichever project the chat is on. */
const userOf = (principal: Principal) => principal.userId;

export const deviceToolHandlers = {
  async list_devices(context) {
    await context.allowed('device.manage');
    const devices = await context.deps.devices.list(userOf(context.principal));
    if (devices.length === 0)
      return 'No paired devices. Settings › Devices shows the one command to connect one.';
    return devices.map(renderDevice).join('\n\n');
  },
  async check_device(context, input) {
    await context.allowed('device.manage');
    return renderDevice(await context.deps.devices.health(context.principal, input.device));
  },
  async fix_device(context, input) {
    await context.allowed('device.manage');
    const device = await context.deps.devices.fix(context.principal, input.device, input.fix);
    return `Ran \`${input.fix}\`.\n${renderDevice(device)}`;
  },
  async revoke_device(context, input) {
    await context.allowed('device.manage');
    await context.deps.devices.revoke(context.principal, input.device);
    return `Revoked device \`${input.device}\`. Its bridge is cut off, and pairing it again needs the browser.`;
  },
} satisfies Partial<ToolHandlers>;
