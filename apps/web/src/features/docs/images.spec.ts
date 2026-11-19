/**
 * @file Which images a document draws from its own folder (decision 13b), and the address it asks the API for.
 */
import { describe, expect, it } from 'vitest';

import { docImageUrl, imageName, isLocalImage, localImagesOf } from './images';

describe('isLocalImage', () => {
  it.each(['img/a.png', './a.png', '../assets/a.svg', 'my%20shot.png', 'صورة.jpeg'])('%s is local', (src) => {
    expect(isLocalImage(src)).toBe(true);
  });

  it.each([
    'https://x.test/a.png',
    'HTTP://x.test/a.png',
    '//x.test/a.png',
    '/abs/a.png',
    'data:image/png;base64,AAAA',
    'javascript:alert(1)',
    'C:/a.png',
    '#top',
    '',
    '  ',
  ])('%s is not', (src) => {
    expect(isLocalImage(src)).toBe(false);
  });
});

describe('localImagesOf', () => {
  it('lists the local images in reading order, once each, inside lists, quotes and tables too', () => {
    const source = [
      '![one](a.png) and ![remote](https://x.test/r.png)',
      '',
      '- ![two](img/b.webp)',
      '',
      '> ![three](../c.svg)',
      '',
      '| x |',
      '| - |',
      '| ![four](d.gif) |',
      '',
      '![again](a.png)',
      '',
      '```md',
      '![in code](code.png)',
      '```',
    ].join('\n');
    expect(localImagesOf(source)).toEqual([
      { src: 'a.png', alt: 'one' },
      { src: 'img/b.webp', alt: 'two' },
      { src: '../c.svg', alt: 'three' },
      { src: 'd.gif', alt: 'four' },
    ]);
  });
});

describe('docImageUrl and imageName', () => {
  it('asks the API under the doc, with the address as written', () => {
    expect(docImageUrl('goteav', 'GTV-12', '../img/a b.png')).toBe(
      '/api/v1/workspaces/goteav/docs/GTV-12/image?src=..%2Fimg%2Fa%20b.png',
    );
  });

  it('names the file without its folders, query or encoding', () => {
    expect(imageName('img/my%20shot.png?raw=1')).toBe('my shot.png');
    expect(imageName('a.png')).toBe('a.png');
    expect(imageName('%zz.png')).toBe('%zz.png');
  });
});
