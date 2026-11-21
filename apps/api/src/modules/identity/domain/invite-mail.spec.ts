/**
 * @file The invite email (docs/16 D69): the link, its date, and on a tailnet the three steps to reach Hub.
 */
import { inviteMail, tailnetOf, testMail } from './invite-mail';

const base = {
  project: 'Goteav',
  inviter: 'Mohmed',
  url: 'https://hub-main.tail0000.ts.net/ar/invite/abc',
  expiresAt: new Date('2026-11-16T09:00:00.000Z'),
};

describe('invite mail', () => {
  it('finds the machine of a tailnet address, and nothing elsewhere', () => {
    expect(tailnetOf('https://mohmed--ahmed.tail0e5baa.ts.net')).toEqual({
      machine: 'mohmed--ahmed',
      host: 'mohmed--ahmed.tail0e5baa.ts.net',
    });
    expect(tailnetOf('http://localhost:7300')).toBeNull();
    expect(tailnetOf('https://hub.goteav.lan')).toBeNull();
    expect(tailnetOf('not a url')).toBeNull();
  });

  it('in Arabic, carries the link on its own line, the date and the Tailscale steps', () => {
    const mail = inviteMail({
      ...base,
      locale: 'ar',
      tailnet: tailnetOf('https://hub-main.tail0000.ts.net'),
    });
    expect(mail.subject).toBe('دعوة للانضمام إلى Goteav في Hub');
    expect(mail.text.split('\n')).toContain(base.url);
    expect(mail.text).toContain('16 نوفمبر 2026');
    expect(mail.text).toContain('https://tailscale.com/download');
    expect(mail.text).toContain('«hub-main»');
    expect(mail.text).toContain('بحسابك أنت');
  });

  it('in English, and with no Tailscale steps when Hub is not on a tailnet', () => {
    const mail = inviteMail({ ...base, locale: 'en', tailnet: null });
    expect(mail.subject).toBe('Join Goteav on Hub');
    expect(mail.text).toContain('Mohmed invited you to Goteav on Hub.');
    expect(mail.text).toContain('16 November 2026');
    expect(mail.text).not.toContain('Tailscale');
  });

  it('the test email names the server it went through', () => {
    expect(testMail('en', 'smtp.gmail.com').text).toContain('smtp.gmail.com');
    expect(testMail('ar', 'smtp.gmail.com').subject).toBe('رسالة تجربة من Hub');
  });
});
