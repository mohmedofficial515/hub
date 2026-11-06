/**
 * @file The folder rule, a chat's title and the JSON cap.
 */
import { capJson, folderIsRegistered, titleFrom } from './folders';

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
