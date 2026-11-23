/**
 * The preset cover gallery. Self-hosted WebP, 1800×600 (3:1) plus a 480×160 thumbnail; sources and licences in
 * ../assets/covers/SOURCES.md. In the port these live in the web app's public assets (or the CDN) and the backend
 * only stores the preset id (`PUT /users/me/cover/preset { presetId }`): one shared file, no per-user crop.
 * `veil` is measured once per preset with image-editor/veil.ts (same rule as uploads) and shipped with the list.
 */
import alula from '../assets/covers/alula.webp';
import alulaThumb from '../assets/covers/alula-thumb.webp';
import antalya from '../assets/covers/antalya.webp';
import antalyaThumb from '../assets/covers/antalya-thumb.webp';
import dubai from '../assets/covers/dubai.webp';
import dubaiThumb from '../assets/covers/dubai-thumb.webp';
import giza from '../assets/covers/giza.webp';
import gizaThumb from '../assets/covers/giza-thumb.webp';
import istanbul from '../assets/covers/istanbul.webp';
import istanbulThumb from '../assets/covers/istanbul-thumb.webp';
import lusail from '../assets/covers/lusail.webp';
import lusailThumb from '../assets/covers/lusail-thumb.webp';
import makkah from '../assets/covers/makkah.webp';
import makkahThumb from '../assets/covers/makkah-thumb.webp';
import riyadh from '../assets/covers/riyadh.webp';
import riyadhThumb from '../assets/covers/riyadh-thumb.webp';
import uploadSample from '../assets/covers/upload-sample.webp';

export type CoverPresetId = 'istanbul' | 'makkah' | 'dubai' | 'giza' | 'riyadh' | 'antalya' | 'lusail' | 'alula';

export interface CoverPreset {
  id: CoverPresetId;
  name: { ar: string; en: string };
  url: string;
  thumbUrl: string;
  /** Pre-measured veil opacity (0.40–0.70), see image-editor/veil.ts. */
  veil: number;
}

export const COVER_PRESETS: CoverPreset[] = [
  { id: 'makkah', name: { ar: 'مكة المكرمة', en: 'Makkah' }, url: makkah, thumbUrl: makkahThumb, veil: 0.60 },
  { id: 'istanbul', name: { ar: 'إسطنبول', en: 'Istanbul' }, url: istanbul, thumbUrl: istanbulThumb, veil: 0.59 },
  { id: 'dubai', name: { ar: 'دبي', en: 'Dubai' }, url: dubai, thumbUrl: dubaiThumb, veil: 0.64 },
  { id: 'giza', name: { ar: 'أهرامات الجيزة', en: 'Giza pyramids' }, url: giza, thumbUrl: gizaThumb, veil: 0.67 },
  { id: 'riyadh', name: { ar: 'الرياض', en: 'Riyadh' }, url: riyadh, thumbUrl: riyadhThumb, veil: 0.60 },
  { id: 'antalya', name: { ar: 'ساحل أنطاليا', en: 'Antalya coast' }, url: antalya, thumbUrl: antalyaThumb, veil: 0.63 },
  { id: 'lusail', name: { ar: 'لوسيل، قطر', en: 'Lusail, Qatar' }, url: lusail, thumbUrl: lusailThumb, veil: 0.64 },
  { id: 'alula', name: { ar: 'العُلا', en: 'AlUla' }, url: alula, thumbUrl: alulaThumb, veil: 0.61 },
];

export function presetById(id: string | null | undefined): CoverPreset | undefined {
  return COVER_PRESETS.find((p) => p.id === id);
}

/** Lab only: stands in for a cover the customer uploaded and cropped (served like a presigned link). */
export const UPLOADED_SAMPLE = uploadSample;
