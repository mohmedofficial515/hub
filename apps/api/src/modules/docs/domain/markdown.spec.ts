/**
 * @file The chunker and readers (docs/06 §6 tests).
 */
import {
  chunksOf,
  docMentionsIn,
  headingsOf,
  kindOf,
  langOf,
  matchesGlob,
  stripFrontMatter,
  titleOf,
} from './markdown';

const para = (n: number, word = 'alpha') => Array.from({ length: n }, () => word).join(' ');

describe('markdown', () => {
  it('strips front-matter and finds the title, else the file name', () => {
    expect(stripFrontMatter('---\nstatus: x\n---\n# Hi\n')).toBe('# Hi\n');
    expect(titleOf('# Refunds\n\ntext', 'a.md')).toBe('Refunds');
    expect(titleOf('no heading', '21-safety.ar.md')).toBe('21-safety');
  });

  it('headings get anchors, keep Arabic, ignore code fences, stop at level 4', () => {
    const body = '# One\n## سياسة الاسترداد\n```\n# not a heading\n```\n## One\n##### five';
    expect(headingsOf(body)).toEqual([
      { level: 1, text: 'One', anchor: 'one' },
      { level: 2, text: 'سياسة الاسترداد', anchor: 'سياسة-الاسترداد' },
      { level: 2, text: 'One', anchor: 'one-1' },
    ]);
  });

  it('detects language by suffix and by share of Arabic letters', () => {
    expect(langOf('a.ar.md', 'english')).toBe('ar');
    expect(langOf('a.md', 'هذا نص عربي كامل')).toBe('ar');
    expect(langOf('a.md', 'an english sentence with كلمة')).toBe('en');
    expect(langOf('a.md', '123')).toBe('en');
  });

  it('kinds', () => {
    expect(kindOf('adr/0001-x.md')).toBe('adr');
    expect(kindOf('docs/adr/0001-x.md')).toBe('adr');
    expect(kindOf('status/2026-11-01.md')).toBe('status');
    expect(kindOf('README.md')).toBe('readme');
    expect(kindOf('sub/README.md')).toBe('readme');
    expect(kindOf('notes.md')).toBe('doc');
    expect(kindOf('notes/a.md', { 'notes/*': 'other' })).toBe('other');
  });

  it('globs', () => {
    expect(matchesGlob('a/b/c.md', '**/*.md')).toBe(true);
    expect(matchesGlob('c.md', '**/*.md')).toBe(true);
    expect(matchesGlob('map/x.md', 'map/**')).toBe(true);
    expect(matchesGlob('other/map/x.md', 'map/**')).toBe(false);
    expect(matchesGlob('a.txt', '**/*.md')).toBe(false);
  });

  it('splits at headings and records the path and anchor', () => {
    const body = `# Top\n\n${para(30)}\n\n## Sub\n\n${para(30)}\n\n### Deep\n\n${para(30)}`;
    const chunks = chunksOf(body);
    expect(chunks.map((chunk) => chunk.heading)).toEqual(['Top', 'Top › Sub', 'Top › Sub › Deep']);
    expect(chunks[1]?.anchor).toBe('sub');
  });

  it('keeps chunks to the limit on blank lines', () => {
    const body = `# T\n\n${Array.from({ length: 6 }, () => para(70)).join('\n\n')}`;
    const chunks = chunksOf(body);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(1500);
  });

  it('merges a tiny chunk into the one before', () => {
    const chunks = chunksOf(`# A\n\n${para(40)}\n\n## B\n\ntiny`);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain('tiny');
  });

  it('never splits a fence or a table, even a long one', () => {
    const code = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n\n');
    const fenced = chunksOf(`# C\n\n\`\`\`\n${code}\n\`\`\`\n`);
    expect(fenced.filter((chunk) => chunk.content.includes('line 199'))[0]?.content).toContain('line 0');
    const table = ['| a | b |', '|---|---|', ...Array.from({ length: 200 }, (_, i) => `| ${i} | x |`)].join('\n');
    const tables = chunksOf(`# T\n\n${para(30)}\n\n${table}\n`);
    const whole = tables.find((chunk) => chunk.content.includes('| 199 |'));
    expect(whole?.content).toContain('| 0 |');
  });

  it('finds document mentions in text', () => {
    expect(docMentionsIn('See docs/21-confirmation-safety.md and README.md, not a.txt')).toEqual([
      'docs/21-confirmation-safety.md',
      'README.md',
    ]);
  });
});
