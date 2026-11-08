/**
 * @file A skill's file (docs/16 §11, D64): Hub reads three fields, writes them back, and keeps every other line of the front matter as it was.
 */
import {
  fieldValue,
  parseSkillFile,
  readHead,
  renameSkillFile,
  writeSkillFile,
  yamlText,
} from './skill-file';

const MOVED = [
  '---',
  'name: gsd-quick',
  'description: "Execute a quick task: atomic commits, state tracking"',
  'argument-hint: "[list | status <slug>]"',
  'allowed-tools:',
  '  - Read',
  '  - Write',
  '---',
  '',
  'Body here.',
  '',
].join('\n');

describe('reading', () => {
  it('quoted, plain, folded and literal descriptions', () => {
    expect(readHead(MOVED, 'gsd-quick').description).toBe(
      'Execute a quick task: atomic commits, state tracking',
    );
    expect(readHead('---\nname: a\ndescription: plain words here\n---\nx', 'a').description).toBe(
      'plain words here',
    );
    expect(readHead("---\nname: a\ndescription: 'it''s fine'\n---\nx", 'a').description).toBe("it's fine");
    expect(readHead('---\nname: a\ndescription: >\n  one\n  two\n---\nx', 'a').description).toBe('one two');
    expect(readHead('---\nname: a\ndescription: |\n  one\n  two\n---\nx', 'a').description).toBe('one\ntwo');
  });

  it('a name that differs from the folder is reported, and the folder stays the name', () => {
    const head = readHead('---\nname: vercel-react\ndescription: x\n---\nbody', 'react');
    expect(head).toMatchObject({ name: 'react', declaredName: 'vercel-react', body: 'body' });
    expect(readHead('---\nname: react\ndescription: x\n---\n', 'react').declaredName).toBeNull();
  });

  it('user-invocable, Windows line ends, and a file with no front matter', () => {
    expect(readHead('---\r\nname: a\r\nuser-invocable: true\r\n---\r\nhi', 'a')).toMatchObject({
      userInvocable: true,
      body: 'hi',
    });
    expect(readHead('Just text.', 'a')).toMatchObject({
      description: '',
      userInvocable: false,
      body: 'Just text.',
    });
  });
});

describe('writing', () => {
  it('a new file has the three fields and the body', () => {
    expect(
      writeSkillFile({ name: 'tidy', description: 'Tidy the repo', userInvocable: true }, 'Do it.'),
    ).toBe('---\nname: tidy\ndescription: Tidy the repo\nuser-invocable: true\n---\n\nDo it.\n');
  });

  it('a description YAML could misread is quoted, Arabic stays plain', () => {
    expect(yamlText('Use when: always')).toBe('"Use when: always"');
    expect(yamlText('- starts with a dash')).toBe('"- starts with a dash"');
    expect(yamlText('# not a comment')).toBe('"# not a comment"');
    expect(yamlText('رتّب المستودع قبل الدمج')).toBe('رتّب المستودع قبل الدمج');
    expect(yamlText('two\nlines')).toBe('two lines');
  });

  it('an edit keeps every other field, in its place', () => {
    const next = writeSkillFile(
      { name: 'gsd-quick', description: 'Quick task', userInvocable: true },
      'New body.',
      parseSkillFile(MOVED),
    );
    expect(next).toBe(
      [
        '---',
        'user-invocable: true',
        'name: gsd-quick',
        'description: Quick task',
        'argument-hint: "[list | status <slug>]"',
        'allowed-tools:',
        '  - Read',
        '  - Write',
        '---',
        '',
        'New body.',
        '',
      ].join('\n'),
    );
    expect(fieldValue(parseSkillFile(next), 'argument-hint')).toBe('[list | status <slug>]');
  });

  it('turning user-invocable off removes the line; the round trip is stable', () => {
    const on = writeSkillFile({ name: 'a', description: 'd', userInvocable: true }, 'b');
    const off = writeSkillFile(
      { name: 'a', description: 'd', userInvocable: false },
      'b',
      parseSkillFile(on),
    );
    expect(off).not.toContain('user-invocable');
    expect(
      writeSkillFile({ name: 'a', description: 'd', userInvocable: false }, 'b', parseSkillFile(off)),
    ).toBe(off);
  });
});

describe('Move to Hub', () => {
  it('only the name line changes on the copy', () => {
    const copy = renameSkillFile(MOVED, 'quick');
    expect(copy.split('\n').filter((line, index) => line !== MOVED.split('\n')[index])).toEqual([
      'name: quick',
    ]);
  });

  it('a file with no name gets one, and one with no front matter gets a head', () => {
    expect(renameSkillFile('---\ndescription: x\n---\nbody', 'a')).toBe(
      '---\nname: a\ndescription: x\n---\n\nbody',
    );
    expect(renameSkillFile('Only text.', 'a')).toContain('name: a');
  });
});
