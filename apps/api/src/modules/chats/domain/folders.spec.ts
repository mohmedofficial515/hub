/**
 * @file The folder rule, a chat's title and the JSON cap.
 */
import { capJson, folderIsRegistered, sameFolder, titleFrom } from './folders';

describe('folderIsRegistered', () => {
  it('allows the folder and what is under it, whatever the slashes and case on Windows', () => {
    expect(folderIsRegistered('C:\\work\\repo', ['C:/work/repo'], 'win32')).toBe(true);
    expect(folderIsRegistered('c:/WORK/repo/src', ['C:\\work\\repo\\'], 'win32')).toBe(true);
  });

  it('refuses a neighbour with the same start, a climb, and anything off the list', () => {
    expect(folderIsRegistered('C:/work/repo-two', ['C:/work/repo'], 'win32')).toBe(false);
    expect(folderIsRegistered('C:/work/repo/../other', ['C:/work/repo'], 'win32')).toBe(false);
    expect(folderIsRegistered('C:/elsewhere', ['C:/work/repo'], 'win32')).toBe(false);
    expect(folderIsRegistered('C:/work/repo', [], 'win32')).toBe(false);
  });

  it("allows Hub's own copy of a registered repository (docs/16 §9.2), and not the owner's folders beside it", () => {
    expect(folderIsRegistered('C:\\work\\wt-GTV-7\\repo', ['C:/work/repo'], 'win32')).toBe(true);
    expect(folderIsRegistered('c:/work/wt-run-0a1b2c3d/repo/src', ['C:/work/repo'], 'win32')).toBe(true);
    expect(folderIsRegistered('C:/work/wt-payments/repo', ['C:/work/repo'], 'win32')).toBe(false);
    expect(folderIsRegistered('C:/work/wt-GTV-7/other', ['C:/work/repo'], 'win32')).toBe(false);
  });

  it('case counts off Windows', () => {
    expect(folderIsRegistered('/work/Repo', ['/work/repo'], 'linux')).toBe(false);
  });
});

describe('titleFrom', () => {
  it('takes the first line, and cuts long ones at a word', () => {
    expect(titleFrom('Fix the build\nand more')).toBe('Fix the build');
    const long = titleFrom(`${'word '.repeat(30)}`);
    expect(long.length).toBeLessThanOrEqual(61);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('capJson', () => {
  it('keeps small values, and marks what it cut', () => {
    expect(capJson({ a: 1 }, 100)).toEqual({ a: 1 });
    expect(capJson({ a: 'x'.repeat(100) }, 20)).toMatchObject({ truncatedByHub: true });
    expect(capJson(undefined, 20)).toBeNull();
  });
});

describe('sameFolder', () => {
  it('is one checkout whatever the slashes, a trailing one and the case', () => {
    expect(sameFolder('C:\\work\\repo\\', 'c:/work/repo')).toBe(true);
    expect(sameFolder('C:/work/repo', 'C:/work/repo-two')).toBe(false);
  });
});
