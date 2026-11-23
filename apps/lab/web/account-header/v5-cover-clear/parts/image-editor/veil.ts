/**
 * Adaptive veil (owner decision v5). One even navy-800 veil + a light backdrop blur covers the whole cover; its
 * opacity is chosen per cover from the photo itself:
 *   1. Blur the final 3:1 crop the way the page will (backdrop-filter: blur(3px) at desktop scale).
 *   2. Map the page regions that carry text (header links, cover button, title, subtitle) into the crop, for the
 *      desktop bands at 1440 and 1920, the tablet band at 768 and the phone band at 390, in both directions (so the
 *      full visible width).
 *   3. Take the brightest blurred pixel of those regions and pick the LOWEST opacity in 0.40–0.70 that keeps white text
 *      at 4.5:1 (14–16 px: links, button, subtitle) and 3:1 (the 28–32 px bold title).
 * Every text on a cover is white, and white over navy-800 at 0.70 on a pure white pixel is 5.0:1, so 0.70 always holds.
 * Runs at save time on the editor's canvas export (and live for the preview); presets carry a pre-measured value.
 */

export const VEIL_MIN = 0.4;
export const VEIL_MAX = 0.7;
export const VEIL_FALLBACK = 0.85;
/** CSS blur of the veil in CSS px; see tokens.css --cc-blur. */
export const VEIL_BLUR_PX = 3;

const NAVY_800 = [31, 50, 92] as const;
const SMALL = 4.5;
const LARGE = 3;

/**
 * Where text sits in the cover band, measured in the lab (v5 page, Cairo): band size and text rows in CSS px from the
 * band top. `small` rows carry 14–16 px text (header links, cover button, subtitle); `large` rows carry the title.
 */
export const BANDS = {
  // 1440 and 1920 windows (scrollbar included), 390 phone. Rows: header controls, camera button, subtitle | title.
  desktop: { width: 1425, height: 305, small: [[10, 54], [81, 125], [153, 177]], large: [[105, 145]] },
  wide: { width: 1905, height: 305, small: [[10, 54], [81, 125], [153, 177]], large: [[105, 145]] },
  tablet: { width: 753, height: 289, small: [[10, 54], [81, 125], [145, 169]], large: [[97, 137]] },
  phone: { width: 375, height: 308, small: [[10, 54], [77, 121], [140, 188]], large: [[97, 132]] },
} as const;

type Band = (typeof BANDS)[keyof typeof BANDS];

/** What part of a 3:1 cover a band shows with object-fit: cover, centred; as fractions of the cover. */
export function visiblePart(band: Pick<Band, 'width' | 'height'>) {
  const a = band.width / band.height;
  return a >= 3
    ? { x0: 0, x1: 1, y0: (1 - 3 / a) / 2, y1: 1 - (1 - 3 / a) / 2 }
    : { x0: (1 - a / 3) / 2, x1: 1 - (1 - a / 3) / 2, y0: 0, y1: 1 };
}

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
/** Contrast of white text on a colour of luminance L. */
export const contrastOnWhite = (L: number) => 1.05 / (L + 0.05);

export interface VeilResult {
  veil: number;
  /** Worst contrast at the chosen veil, for the report and the editor. */
  small: number;
  large: number;
}

const W = 600;
const H = 200;

/**
 * @param source the final crop (any 3:1 canvas or a loaded 3:1 image).
 */
export function measureVeil(source: CanvasImageSource): VeilResult {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { veil: VEIL_MAX, small: 5, large: 5 };
  // 3 CSS px at desktop scale (a 1425 px band shows 1800 crop px) is 3.8 crop px = 1.3 px here. The phone band magnifies
  // the photo, so its blur is wider; the desktop value is the conservative (sharper, brighter) one.
  const blur = (VEIL_BLUR_PX * (1800 / BANDS.desktop.width) * W) / 1800;
  ctx.filter = `blur(${blur.toFixed(2)}px)`;
  ctx.drawImage(source, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  const collect = (kind: 'small' | 'large') => {
    const px: number[] = [];
    for (const band of Object.values(BANDS)) {
      const v = visiblePart(band);
      const x0 = Math.floor(v.x0 * W);
      const x1 = Math.ceil(v.x1 * W);
      for (const [top, bottom] of band[kind]) {
        const y0 = Math.max(0, Math.floor((v.y0 + (top / band.height) * (v.y1 - v.y0)) * H));
        const y1 = Math.min(H, Math.ceil((v.y0 + (bottom / band.height) * (v.y1 - v.y0)) * H));
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x += 1) {
            const i = (y * W + x) * 4;
            // Blur fades the canvas edge to transparent; those pixels are not part of the photo.
            if (data[i + 3] < 250) continue;
            px.push(data[i], data[i + 1], data[i + 2]);
          }
      }
    }
    return px;
  };
  const small = collect('small');
  const large = collect('large');

  const worst = (px: number[], a: number) => {
    let maxL = 0;
    for (let i = 0; i < px.length; i += 3) {
      const L = lum(
        a * NAVY_800[0] + (1 - a) * px[i],
        a * NAVY_800[1] + (1 - a) * px[i + 1],
        a * NAVY_800[2] + (1 - a) * px[i + 2],
      );
      if (L > maxL) maxL = L;
    }
    return contrastOnWhite(maxL);
  };

  for (let step = Math.round(VEIL_MIN * 100); step <= Math.round(VEIL_MAX * 100); step++) {
    const a = step / 100;
    const s = worst(small, a);
    const l = worst(large, a);
    if (s >= SMALL && l >= LARGE) return { veil: a, small: s, large: l };
  }
  return { veil: VEIL_MAX, small: worst(small, VEIL_MAX), large: worst(large, VEIL_MAX) };
}
