/**
 * @file audit.ts
 * @description One page's measured check: overflow and AA contrast on what it really rendered. Shared by the page matrix and the panel's thread.
 */
import type { Page } from '@playwright/test';

/** Overflow and AA contrast on rendered text, composited against the nearest opaque background. */
export const audit = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    type Rgb = { r: number; g: number; b: number; a: number };
    const rgb = (colour: string): Rgb => {
      if (!canvas) return { r: 0, g: 0, b: 0, a: 1 };
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillStyle = colour;
      canvas.fillRect(0, 0, 1, 1);
      const data = canvas.getImageData(0, 0, 1, 1).data;
      return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0, a: (data[3] ?? 0) / 255 };
    };
    const lum = ({ r, g, b }: Rgb) => {
      const part = (value: number) => {
        const v = value / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * part(r) + 0.7152 * part(g) + 0.0722 * part(b);
    };
    const over = (top: Rgb, under: Rgb): Rgb => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
      a: 1,
    });
    const background = (element: Element) => {
      const stack: Rgb[] = [];
      for (let e: Element | null = element; e; e = e.parentElement) {
        const colour = rgb(getComputedStyle(e).backgroundColor);
        if (colour.a > 0) {
          stack.push(colour);
          if (colour.a === 1) break;
        }
      }
      let out: Rgb = { r: 255, g: 255, b: 255, a: 1 };
      const last = stack[stack.length - 1];
      if (last?.a === 1) out = stack.pop() ?? out;
      while (stack.length > 0) out = over(stack.pop() as Rgb, out);
      return out;
    };
    /** The colour stops of the gradient that paints this text, when its ink is transparent and an element up the tree clips a background to text. */
    const gradientInk = (element: Element): Rgb[] | null => {
      if (rgb(getComputedStyle(element).color).a > 0) return null;
      for (let e: Element | null = element; e; e = e.parentElement) {
        const style = getComputedStyle(e);
        const clip = style.backgroundClip || style.getPropertyValue('-webkit-background-clip');
        if (clip !== 'text') continue;
        const stops = style.backgroundImage.match(
          /(?:rgba?|hsla?|oklch|oklab|lch|lab|color)\([^()]*\)|#[0-9a-f]{3,8}/gi,
        );
        return stops?.length ? stops.map(rgb) : null;
      }
      return null;
    };
    const fails: string[] = [];
    let nodes = 0;
    let lowest = 99;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode;
      const element = text.parentElement;
      if (!text.textContent?.trim() || !element) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      if (element.closest('[hidden],[aria-hidden=true],.sr-only,option,script,style,[disabled]')) continue;
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const under = background(element);
      const contrast = (colour: Rgb) => {
        const [a, b] = [lum(over(colour, under)), lum(under)];
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      // Gradient text (`background-clip: text` over transparent ink) is read at its weakest stop, never as the transparent colour.
      const painted = gradientInk(element);
      const ratio = painted ? Math.min(...painted.map(contrast)) : contrast(rgb(style.color));
      nodes += 1;
      lowest = Math.min(lowest, ratio);
      const px = parseFloat(style.fontSize);
      const bold = Number(style.fontWeight) >= 700;
      if (ratio < (px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5)) {
        fails.push(`${text.textContent.trim().slice(0, 40)} ${ratio.toFixed(2)}`);
      }
    }
    const doc = document.documentElement;
    return {
      overflow: doc.scrollWidth - doc.clientWidth,
      nodes,
      lowest: Number(lowest.toFixed(2)),
      fails: fails.slice(0, 6),
    };
  });
