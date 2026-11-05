/**
 * @file Owner and pm see all ready work; everyone else sees what is routed to their roles (review M6).
 */
import { describe, expect, it } from 'vitest';

import { SPECIALTIES } from '../roles';
import { readySpecialties, seesAllReadyWork } from './ready';

describe('ready work', () => {
  it('owner and pm see every specialty', () => {
    expect(seesAllReadyWork(['owner'])).toBe(true);
    expect(seesAllReadyWork(['accountant', 'pm'])).toBe(true);
    expect(readySpecialties(['owner'])).toEqual([...SPECIALTIES]);
    expect(readySpecialties(['pm'])).toEqual([...SPECIALTIES]);
  });

  it('another member keeps what is routed to their roles', () => {
    expect(seesAllReadyWork(['backend'])).toBe(false);
    expect(readySpecialties(['backend'])).toContain('backend');
    expect(readySpecialties(['backend'])).not.toContain('frontend');
    expect(readySpecialties(['frontend', 'qa'])).toEqual(expect.arrayContaining(['frontend', 'qa']));
  });

  it('a role with no specialty sees none', () => {
    expect(readySpecialties(['accountant'])).toEqual([]);
  });
});
