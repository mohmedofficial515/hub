/** Passenger form values and the rules of develop's checkout validation that this version shows. */
import { LAST_ARRIVAL, type Gender, type PassengerSlot, type SavedTraveller } from './data';

export interface PaxValues {
  savedId: string | null;
  savedMasked: string | null;
  givenName: string;
  familyName: string;
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  gender: Gender | '';
  /** '' = derived from gender, as on develop. */
  title: '' | 'MR' | 'MRS' | 'MS' | 'MISS' | 'DR';
  nationality: string;
  passportNumber: string;
  passportCountry: string;
  expDay: string;
  expMonth: string;
  expYear: string;
  saveTraveller: boolean;
}

export const emptyPax = (): PaxValues => ({
  savedId: null,
  savedMasked: null,
  givenName: '',
  familyName: '',
  birthDay: '',
  birthMonth: '',
  birthYear: '',
  gender: '',
  title: '',
  nationality: '',
  passportNumber: '',
  passportCountry: '',
  expDay: '',
  expMonth: '',
  expYear: '',
  saveTraveller: false,
});

export function fromSaved(t: SavedTraveller): PaxValues {
  const [y, m, d] = t.birthDate.split('-');
  const [ey = '', em = '', ed = ''] = t.document?.expiryDate.split('-') ?? [];
  return {
    ...emptyPax(),
    savedId: t.id,
    savedMasked: t.document?.numberMasked ?? null,
    givenName: t.givenName,
    familyName: t.familyName,
    birthDay: String(Number(d)),
    birthMonth: String(Number(m)),
    birthYear: y,
    gender: t.gender,
    nationality: t.nationality,
    passportCountry: t.document?.country ?? '',
    expDay: ed ? String(Number(ed)) : '',
    expMonth: em ? String(Number(em)) : '',
    expYear: ey,
  };
}

/** NAME_RE on develop: Latin letters, single spaces, apostrophes or hyphens between them. */
const NOT_LATIN = /[^\p{Script=Latin} '-]/gu;
export function cleanName(raw: string) {
  const cleaned = raw.replace(NOT_LATIN, '');
  return { value: cleaned.toUpperCase().replace(/\s{2,}/g, ' '), stripped: cleaned.length !== raw.length };
}

export function cleanPassport(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

export function derivedTitle(v: PaxValues, slot: PassengerSlot) {
  if (v.title) return v.title;
  if (v.gender === 'M') return 'MR';
  if (v.gender === 'F') return slot.type === 'ADULT' ? 'MS' : 'MISS';
  return '';
}

export const titleOptions = (slot: PassengerSlot) =>
  slot.type === 'ADULT' ? (['MR', 'MRS', 'MS', 'MISS', 'DR'] as const) : (['MR', 'MISS'] as const);

/** "ALHARBI/MOHAMMED SALEH MR", the way airline systems print a name. */
export function ticketName(v: PaxValues, slot: PassengerSlot) {
  if (!v.familyName.trim() && !v.givenName.trim()) return '';
  const title = derivedTitle(v, slot);
  return `${v.familyName.trim() || '…'}/${v.givenName.trim() || '…'}${title ? ` ${title}` : ''}`;
}

const pad = (s: string) => s.padStart(2, '0');
const isoOf = (y: string, m: string, d: string) => (y && m && d ? `${y}-${pad(m)}-${pad(d)}` : '');

export function expiryState(v: PaxValues): 'ok' | 'expired' | 'six-months' | 'unset' {
  const iso = isoOf(v.expYear, v.expMonth, v.expDay);
  if (!iso) return 'unset';
  if (iso <= LAST_ARRIVAL) return 'expired';
  const [y, m, d] = LAST_ARRIVAL.split('-').map(Number);
  const sixMonths = `${m + 6 > 12 ? y + 1 : y}-${pad(String(((m + 5) % 12) + 1))}-${pad(String(d))}`;
  return iso < sixMonths ? 'six-months' : 'ok';
}

/** Required fields still empty (documents required for this airline). */
export function missingCount(v: PaxValues) {
  let n = 0;
  if (!v.givenName.trim()) n++;
  if (!v.familyName.trim()) n++;
  if (!v.birthDay || !v.birthMonth || !v.birthYear) n++;
  if (!v.gender) n++;
  if (!v.passportNumber && !v.savedMasked) n++;
  if (!v.passportCountry) n++;
  if (expiryState(v) === 'unset' || expiryState(v) === 'expired') n++;
  return n;
}

export interface ContactValues {
  email: string;
  phoneCode: string;
  phone: string;
}

export function contactMissing(c: ContactValues) {
  let n = 0;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) n++;
  if (c.phone.replace(/\D/g, '').length < 7) n++;
  return n;
}
