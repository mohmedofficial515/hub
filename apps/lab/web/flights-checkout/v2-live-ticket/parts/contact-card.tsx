import { Mail } from 'lucide-react';
import type { T } from '../i18n';
import type { ContactValues } from './form';
import { Field, SectionCard, SelectInput, TextInput } from './ui';

const CODES = [
  { code: '+966', country: 'SA' },
  { code: '+20', country: 'EG' },
  { code: '+90', country: 'TR' },
  { code: '+965', country: 'KW' },
  { code: '+971', country: 'AE' },
  { code: '+962', country: 'JO' },
];

export function ContactCard({ t, value, onChange }: { t: T; value: ContactValues; onChange: (patch: Partial<ContactValues>) => void }) {
  return (
    <SectionCard title={t.contact.title} hint={t.contact.hint} icon={<Mail className="size-5" />}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t.contact.email} htmlFor="contact-email">
          <TextInput
            id="contact-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            spellCheck={false}
            value={value.email}
            placeholder="name@example.com"
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
        <Field label={t.contact.phone} htmlFor="contact-phone">
          <div dir="ltr" className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
            <SelectInput aria-label={t.contact.code} value={value.phoneCode} onChange={(e) => onChange({ phoneCode: e.target.value })}>
              {CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.country} {c.code}
                </option>
              ))}
            </SelectInput>
            <TextInput
              id="contact-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={value.phone}
              placeholder="55 214 7730"
              onChange={(e) => onChange({ phone: e.target.value.replace(/[^\d ]/g, '') })}
              className="tabular-nums"
            />
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}
