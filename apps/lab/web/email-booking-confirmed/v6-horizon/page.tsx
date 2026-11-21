import { useLocale } from '@lab/i18n';
import { EmailPreview } from '@lab/email/EmailPreview';
import subject from '@lab/email/subject.hbs?raw';
import body from './bookings.confirmed.html.hbs?raw';
import layout from './layout.hbs?raw';
import heroLtr from './assets/hero-ltr.jpg?url';
import heroRtl from './assets/hero-rtl.jpg?url';
import { messages } from './i18n';

const partials = import.meta.glob<string>('./partials/*.hbs', { query: '?raw', import: 'default', eager: true });

/** The sun sits on the side away from the text, so the image is mirrored per direction. */
export default function Page() {
  const heroUrl = new URL(useLocale() === 'ar' ? heroRtl : heroLtr, location.href).href;
  return <EmailPreview version={{ layout, body, subject, partials, messages, context: { heroUrl } }} />;
}
