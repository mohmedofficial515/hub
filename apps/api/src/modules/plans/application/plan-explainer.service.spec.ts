/**
 * @file The explainer's captions are WebVTT text and nothing else.
 */
import { readCaptions } from './plan-explainer.service';

describe('readCaptions', () => {
  it('keeps WebVTT text and drops a BOM', () => {
    const text = '﻿WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\nدي الخطة\n';
    expect(readCaptions(Buffer.from(text, 'utf8')).toString('utf8').startsWith('WEBVTT')).toBe(true);
    expect(readCaptions(Buffer.from('WEBVTT - Arabic\n', 'utf8')).length).toBeGreaterThan(0);
  });

  it('refuses anything that is not WebVTT, and an oversized file', () => {
    expect(() => readCaptions(Buffer.from('<script>alert(1)</script>'))).toThrow();
    expect(() => readCaptions(Buffer.from('WEBVTTX\n'))).toThrow();
    expect(() => readCaptions(Buffer.from('WEBVTT\n\0'))).toThrow();
    expect(() => readCaptions(Buffer.alloc(600 * 1024, 65))).toThrow();
  });
});
