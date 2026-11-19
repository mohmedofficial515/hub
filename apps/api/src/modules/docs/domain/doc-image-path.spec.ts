/**
 * @file Where an image a document names lives in its source (decision 13b): traversal is refused first, then the types.
 */
import { DOC_IMAGE_MAX_BYTES, DOC_IMAGE_TYPES, resolveDocImage } from './doc-image-path';

describe('resolveDocImage', () => {
  describe('refuses a way out of the source', () => {
    it.each([
      ['../secret.png', 'guide.md'],
      ['../../secret.png', 'docs/guide.md'],
      ['img/../../../secret.png', 'docs/guide.md'],
      ['%2e%2e/secret.png', 'guide.md'],
      ['%2E%2E%2Fsecret.png', 'guide.md'],
      ['..%2f..%2fsecret.png', 'docs/guide.md'],
      ['/etc/passwd.png', 'guide.md'],
      ['%2fetc%2fshot.png', 'guide.md'],
      ['C:/Windows/shot.png', 'guide.md'],
      ['c:shot.png', 'guide.md'],
      ['\\\\server\\share\\shot.png', 'guide.md'],
      ['img\\shot.png', 'guide.md'],
      ['img%5cshot.png', 'guide.md'],
      ['//evil.test/shot.png', 'guide.md'],
      ['https://evil.test/shot.png', 'guide.md'],
      ['data:image/png;base64,AAAA', 'guide.md'],
      ['file:///etc/shot.png', 'guide.md'],
      ['img/shot%00.png', 'guide.md'],
      ['%zz.png', 'guide.md'],
      ['', 'guide.md'],
      ['   ', 'guide.md'],
      ['.', 'guide.md'],
      ['img/', 'guide.md'],
      ['a.txt:b.png', 'guide.md'],
      ['a.txt%3Ab.png', 'guide.md'],
      ['img/notes.txt:hidden.png', 'docs/guide.md'],
    ])('%s from %s', (src, doc) => {
      expect(resolveDocImage(doc, src)).toEqual({ ok: false, reason: 'bad_path' });
    });

    it('refuses a document path that itself leaves the source', () => {
      expect(resolveDocImage('../outside/guide.md', 'shot.png')).toEqual({ ok: false, reason: 'bad_path' });
      expect(resolveDocImage('/abs/guide.md', 'shot.png')).toEqual({ ok: false, reason: 'bad_path' });
    });

    it('refuses a name longer than a path can be', () => {
      expect(resolveDocImage('guide.md', `${'a'.repeat(600)}.png`)).toEqual({
        ok: false,
        reason: 'bad_path',
      });
    });
  });

  describe('resolves inside the source', () => {
    it('next to the document', () => {
      expect(resolveDocImage('docs/guide.md', 'shot.png')).toEqual({
        ok: true,
        path: 'docs/shot.png',
        type: 'image/png',
      });
    });

    it('with ./ and a folder', () => {
      expect(resolveDocImage('docs/guide.md', './img/a.webp')).toMatchObject({
        ok: true,
        path: 'docs/img/a.webp',
      });
    });

    it('up a folder while it stays inside', () => {
      expect(resolveDocImage('docs/adr/0001.md', '../assets/flow.svg')).toEqual({
        ok: true,
        path: 'docs/assets/flow.svg',
        type: 'image/svg+xml',
      });
      expect(resolveDocImage('docs/guide.md', '../logo.gif')).toMatchObject({ ok: true, path: 'logo.gif' });
    });

    it('a document at the root', () => {
      expect(resolveDocImage('README.md', 'shot.JPG')).toEqual({
        ok: true,
        path: 'shot.JPG',
        type: 'image/jpeg',
      });
    });

    it('decodes the address once, and drops a query or a fragment', () => {
      expect(resolveDocImage('guide.md', 'my%20shot.png?raw=true#top')).toMatchObject({
        ok: true,
        path: 'my shot.png',
      });
      expect(resolveDocImage('guide.md', '%252e%252e/a.png')).toMatchObject({
        ok: true,
        path: '%2e%2e/a.png',
      });
    });

    it('keeps Arabic names', () => {
      expect(resolveDocImage('دليل/البدء.md', 'صورة.jpeg')).toMatchObject({
        ok: true,
        path: 'دليل/صورة.jpeg',
      });
    });
  });

  describe('types', () => {
    it.each(['a.md', 'a.html', 'a.svgz', 'a.png.exe', 'a', 'a.txt', '.env'])('refuses %s', (src) => {
      expect(resolveDocImage('guide.md', src)).toEqual({ ok: false, reason: 'type' });
    });

    it('serves exactly the image types', () => {
      expect(Object.keys(DOC_IMAGE_TYPES).sort()).toEqual(['.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
    });

    it('caps the size', () => {
      expect(DOC_IMAGE_MAX_BYTES).toBe(10 * 1024 * 1024);
    });
  });
});
