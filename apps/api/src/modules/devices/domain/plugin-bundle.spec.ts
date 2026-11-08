/**
 * @file Hub's plugin as a device installs it (docs/16 §11, D64): a version that moves with any file, written into both manifests, and each skill's hash.
 */
import { bundleOf, MARKETPLACE_FILE, PLUGIN_FILE, skillHashes, skillHashOf } from './plugin-bundle';

const RAW = [
  {
    path: MARKETPLACE_FILE,
    text: JSON.stringify({ name: 'hub', plugins: [{ name: 'hub', source: './plugin', version: '0.1.0' }] }),
  },
  { path: PLUGIN_FILE, text: JSON.stringify({ name: 'hub', version: '0.1.0' }) },
  { path: 'plugin/skills/work/SKILL.md', text: '---\nname: work\n---\nwork' },
  { path: 'plugin/skills/tidy/SKILL.md', text: '---\nname: tidy\n---\ntidy' },
  { path: 'plugin/skills/tidy/notes/a.md', text: 'a' },
  { path: 'plugin/skills/empty/readme.md', text: 'no SKILL.md here' },
  { path: 'plugin/hooks/hooks.json', text: '{}' },
];

describe('the bundle', () => {
  it('the version is the package’s, then the files’ hash, and both manifests carry it', () => {
    const bundle = bundleOf(RAW, '0.1.0');
    expect(bundle.version).toMatch(/^0\.1\.0-sync\.[0-9a-f]{12}$/);
    const market = JSON.parse(bundle.files.find((file) => file.path === MARKETPLACE_FILE)!.text);
    const plugin = JSON.parse(bundle.files.find((file) => file.path === PLUGIN_FILE)!.text);
    expect(market.plugins[0]).toMatchObject({ name: 'hub', source: './plugin', version: bundle.version });
    expect(plugin.version).toBe(bundle.version);
  });

  it('any change to any file changes the version; the order of reading does not', () => {
    const base = bundleOf(RAW, '0.1.0').version;
    expect(bundleOf([...RAW].reverse(), '0.1.0').version).toBe(base);
    const edited = RAW.map((file) =>
      file.path.endsWith('tidy/SKILL.md') ? { ...file, text: `${file.text}!` } : file,
    );
    expect(bundleOf(edited, '0.1.0').version).not.toBe(base);
    expect(bundleOf([...RAW, { path: 'plugin/skills/new/SKILL.md', text: 'x' }], '0.1.0').version).not.toBe(
      base,
    );
  });

  it('each skill folder with a SKILL.md has a hash, from its own files only', () => {
    const skills = skillHashes(RAW);
    expect(Object.keys(skills)).toEqual(['tidy', 'work']);
    expect(skills['tidy']).toBe(
      skillHashOf([
        { path: 'notes/a.md', text: 'a' },
        { path: 'SKILL.md', text: '---\nname: tidy\n---\ntidy' },
      ]),
    );
    const otherWork = RAW.map((file) => (file.path.includes('/work/') ? { ...file, text: 'changed' } : file));
    expect(skillHashes(otherWork)['tidy']).toBe(skills['tidy']);
  });

  it('a manifest that does not read keeps its text', () => {
    const raw = RAW.map((file) => (file.path === PLUGIN_FILE ? { ...file, text: 'not json' } : file));
    expect(bundleOf(raw, '0.1.0').files.find((file) => file.path === PLUGIN_FILE)?.text).toBe('not json');
  });
});
