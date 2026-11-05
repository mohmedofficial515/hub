/**
 * @file Cookie flags: Secure follows the public URL, the rest never change.
 */
import { baseCookieOptions } from './cookies';

describe('baseCookieOptions', () => {
  it('is Secure, HttpOnly and SameSite=Lax over https', () => {
    expect(baseCookieOptions({ HUB_PUBLIC_URL: 'https://hub.goteav.lan' })).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
    });
  });

  it('is not Secure on the first release plain http://localhost (D33)', () => {
    const options = baseCookieOptions({ HUB_PUBLIC_URL: 'http://localhost:7300' });
    expect(options.secure).toBe(false);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe('lax');
  });

  it('adds the configured domain', () => {
    const options = baseCookieOptions({
      HUB_PUBLIC_URL: 'https://hub.goteav.lan',
      SESSION_COOKIE_DOMAIN: 'goteav.lan',
    });
    expect(options.domain).toBe('goteav.lan');
  });
});
