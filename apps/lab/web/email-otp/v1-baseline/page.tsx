import { EmailPreview } from '@lab/email/EmailPreview';
import { otpStrings, otpFixtures } from '@lab/email/trials';
import logo from '../../email-booking-confirmed/v1-baseline/assets/logo-icon.png?inline';
import layout from '../../email-booking-confirmed/v1-baseline/layout.hbs?raw';
import subject from '../subject.hbs?raw';
import body from './body.hbs?raw';
const code = `<p dir="ltr" style="margin:24px 0;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#0b3d5c;font-family:'SFMono-Regular',Menlo,Consolas,monospace;">{{code}}</p>`;

const shared = import.meta.glob<string>('../../email-booking-confirmed/v1-baseline/partials/*.hbs', { query: '?raw', import: 'default', eager: true });

/** The current production template, unchanged, with the current layout. */
export default function Page() {
  return <EmailPreview version={{ layout, body, subject, partials: { ...shared, code }, messages: otpStrings, fixtures: otpFixtures, context: { logo } }} />;
}
