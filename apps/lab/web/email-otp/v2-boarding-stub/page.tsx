import { EmailPreview } from '@lab/email/EmailPreview';
import { mergeStrings } from '@lab/email/strings';
import { otpStrings, otpFixtures } from '@lab/email/trials';
import body from './body.hbs?raw';
import subject from '../subject.hbs?raw';
import layout from '../../email-booking-confirmed/v8-boarding-complete/layout.hbs?raw';
import { messages } from './i18n';

const partials = import.meta.glob<string>('../../email-booking-confirmed/v8-boarding-complete/partials/*.hbs', { query: '?raw', import: 'default', eager: true });

/** The approved ticket layout and partials of the confirmation pilot, with only this body and these strings. */
export default function Page() {
  return (
    <EmailPreview
      version={{
        layout,
        body,
        subject,
        partials,
        messages: {
          ar: mergeStrings(otpStrings.ar, messages.ar),
          en: mergeStrings(otpStrings.en, messages.en),
        },
        fixtures: otpFixtures,
      }}
    />
  );
}
