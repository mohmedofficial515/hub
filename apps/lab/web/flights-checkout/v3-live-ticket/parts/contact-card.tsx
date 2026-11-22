import { Mail } from 'lucide-react';
import type { T } from '../i18n';
import type { ContactValues } from './form';
import { Field, SectionCard, SelectInput, TextInput } from './ui';

/** The select shows only the code, so it is never cut; the country name is in each option and in the label. */
const CODES = [
  { code: '+966', country: { ar: 'السعودية', en: 'Saudi Arabia' } },
  { code: '+20', country: { ar: 'مصر', en: 'Egypt' } },
  { code: '+90', country: { ar: 'تركيا', en: 'Türkiye' } },
  { code: '+965', country: { ar: 'الكويت', en: 'Kuwait' } },
  { code: '+971', country: { ar: 'الإمارات', en: 'United Arab Emirates' } },
  { code: '+962', country: { ar: 'الأردن', en: 'Jordan' } },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactCard({
  t,
  lang,
  value,
  onChange,
  showRequired,
}: {
  t: T;
  lang: 'ar' | 'en';
  value: ContactValues;
  onChange: (patch: Partial<ContactValues>) => void;
  showRequired: boolean;
}) {
  const errEmail = showRequired && !EMAIL_RE.test(value.email) ? t.pax.required : undefined;
  const errPhone = showRequired && value.phone.replace(/\D/g, '').length < 7 ? t.pax.required : undefined;
  return (
    <SectionCard title={t.contact.title} hint={t.contact.hint} icon={<Mail className="size-5" />}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t.contact.email} htmlFor="contact-email" error={errEmail} msgId="contact-email-msg">
          <TextInput
            id="contact-email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            spellCheck={false}
            value={value.email}
            invalid={!!errEmail}
            aria-required
            aria-describedby={errEmail ? 'contact-email-msg' : undefined}
            placeholder="name@example.com"
            onChange={(e) => onChange({ email: e.target.value })}
          />
        </Field>
        <Field label={t.contact.phone} htmlFor="contact-phone" error={errPhone} msgId="contact-phone-msg">
          <div dir="ltr" className="grid grid-cols-[6.75rem_minmax(0,1fr)] gap-2">
            <SelectInput aria-label={t.contact.code} value={value.phoneCode} onChange={(e) => onChange({ phoneCode: e.target.value })}>
              {CODES.map((c) => (
                <option key={c.code} value={c.code} label={c.code}>
                  {c.code} {c.country[lang]}
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
              invalid={!!errPhone}
              aria-required
              aria-describedby={errPhone ? 'contact-phone-msg' : undefined}
              onChange={(e) => onChange({ phone: e.target.value.replace(/[^\d ]/g, '') })}
              className="tabular-nums"
            />
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}
