import { EmailPreview } from '@lab/email/EmailPreview';
import subject from '@lab/email/subject.hbs?raw';
import body from './bookings.confirmed.html.hbs?raw';
import layout from './layout.hbs?raw';
import { messages } from './i18n';

const partials = import.meta.glob<string>('./partials/*.hbs', { query: '?raw', import: 'default', eager: true });

export default function Page() {
  return <EmailPreview version={{ layout, body, subject, partials, messages, toggles: [{ key: 'showFareRules', label: 'fare rules' }] }} />;
}
