/**
 * @file invite-share.ts
 * @description How the owner sends an invite link themselves (docs/16 D68): the message, a WhatsApp link, a mail draft, and the tailnet the
 * friend must join first (D69). Pure, so the dialog and its tests read one rule. The tailnet rule is the API's (`tailnetOf`).
 */
import { fmt } from '@/components/common/text';
import type { MembersMessages } from '@/features/members/messages';

export interface Tailnet {
  /** The machine's name on the tailnet, as Tailscale's Machines page lists it. */
  readonly machine: string;
}

/** Hub is on a tailnet when its public address is a `*.ts.net` name. `dnsName` is what Tailscale itself reports, when known. */
export function tailnetOf(publicUrl: string | undefined, dnsName?: string | null): Tailnet | null {
  const host = (() => {
    try {
      return publicUrl ? new URL(publicUrl).hostname : '';
    } catch {
      return '';
    }
  })();
  const name = host.endsWith('.ts.net') ? host : dnsName?.endsWith('.ts.net') ? dnsName : '';
  const machine = name.split('.')[0];
  return name && machine ? { machine } : null;
}

export interface InviteMessage {
  readonly inviter: string;
  readonly project: string;
  readonly url: string;
  readonly tailnet: Tailnet | null;
}

type Words = MembersMessages['inviteLink'];

/** The text the owner sends: the link on its own line, and on a tailnet how to reach Hub. */
export function inviteText(words: Words, message: InviteMessage): string {
  const text = fmt(words.text, { inviter: message.inviter, project: message.project, url: message.url });
  if (!message.tailnet) return text;
  return `${text}\n\n${fmt(words.textTailnet, { inviter: message.inviter, machine: message.tailnet.machine })}`;
}

export const TAILSCALE_MACHINES = 'https://login.tailscale.com/admin/machines';

export function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function mailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The browser's own share sheet, where it has one (phones, Safari, Edge on Windows). */
export function canShare(text: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;
  return typeof navigator.canShare === 'function' ? navigator.canShare({ text }) : true;
}
