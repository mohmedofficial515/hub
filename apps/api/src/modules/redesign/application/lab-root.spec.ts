/**
 * @file The default lab folder and the addresses of its versions.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultLabRoot, labFrameUrl, labVersionUrl } from './lab-root';

describe('defaultLabRoot', () => {
  let repo: string;
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'hub-lab-root-'));
    mkdirSync(join(repo, 'apps/api'), { recursive: true });
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  const withLab = () => {
    mkdirSync(join(repo, 'apps/lab/lab'), { recursive: true });
    writeFileSync(join(repo, 'apps/lab/lab/index.html'), '');
  };

  it('finds apps/lab from the repository root and from apps/api', () => {
    withLab();
    const expected = join(repo, 'apps/lab').split('\\').join('/');
    expect(defaultLabRoot(repo)).toBe(expected);
    expect(defaultLabRoot(join(repo, 'apps/api'))).toBe(expected);
  });

  it('is null when there is no lab here', () => {
    expect(defaultLabRoot(repo)).toBeNull();
  });
});

describe('lab addresses', () => {
  it('are on Hub, with no host', () => {
    expect(labVersionUrl('web/wallet/v2-flight-path')).toBe('/lab/#/web/wallet/v2-flight-path');
    expect(labFrameUrl('web', 'wallet', 'v2-flight-path')).toBe('/lab/frame-web.html#/wallet/v2-flight-path');
  });
});
