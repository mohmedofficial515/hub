/**
 * @file The message an owner sends with an invite link, and the tailnet step (docs/16 D68, D69).
 */
import { describe, expect, it } from 'vitest';

import en from '../../../messages/en/members.json';
import { inviteText, mailtoHref, tailnetOf, whatsappHref } from './invite-share';

const url = 'https://mohmed--ahmed.tail0e5baa.ts.net/ar/invite/abc_-DEF';

describe('invite share', () => {
  it('finds the machine of a tailnet address, from the URL or what Tailscale reports', () => {
    expect(tailnetOf(url)).toEqual({ machine: 'mohmed--ahmed' });
    expect(tailnetOf('http://localhost:7300', 'main-pc.tail1.ts.net')).toEqual({ machine: 'main-pc' });
    expect(tailnetOf('http://localhost:7300')).toBeNull();
    expect(tailnetOf('https://hub.goteav.lan', null)).toBeNull();
    expect(tailnetOf(undefined)).toBeNull();
  });

  it('puts the link on its own line, and the Tailscale steps after it on a tailnet', () => {
    const text = inviteText(en.inviteLink, {
      inviter: 'Mohmed',
      project: 'Goteav',
      url,
      tailnet: { machine: 'mohmed--ahmed' },
    });
    expect(text.split('\n')).toContain(url);
    expect(text).toContain('Mohmed invited you to Goteav on Hub.');
    expect(text).toContain('https://tailscale.com/download');
    expect(text).toContain('“mohmed--ahmed”');
    const plain = inviteText(en.inviteLink, { inviter: 'Mohmed', project: 'Goteav', url, tailnet: null });
    expect(plain).not.toContain('Tailscale');
  });

  it('builds the WhatsApp and mail links with the whole text, link included', () => {
    const text = `Join:\n${url}`;
    expect(decodeURIComponent(whatsappHref(text).replace('https://wa.me/?text=', ''))).toBe(text);
    const mail = new URL(mailtoHref('friend@example.test', 'Invitation', text));
    expect(mail.protocol).toBe('mailto:');
    expect(mail.pathname).toBe('friend@example.test');
    expect(mail.searchParams.get('subject')).toBe('Invitation');
    expect(mail.searchParams.get('body')).toBe(text);
  });
});
