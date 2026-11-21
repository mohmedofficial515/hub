/**
 * @file The settings catalogue: every key has a schema and a default the schema accepts (docs/12 H0-04).
 */
import { describe, expect, it } from 'vitest';

import {
  isSettingKey,
  parseSetting,
  SETTING_KEYS,
  settingDefault,
  SETTINGS,
  settingsCatalogue,
} from './settings';

describe('settings catalogue', () => {
  it.each(SETTING_KEYS)('%s: the default passes its own schema', (key) => {
    expect(SETTINGS[key].schema.safeParse(SETTINGS[key].default).success).toBe(true);
  });

  it('has every key of docs/03 §4.2', () => {
    expect(SETTING_KEYS).toHaveLength(23);
  });

  it('the catalogue describes every key in both languages, with a JSON schema', () => {
    for (const row of settingsCatalogue()) {
      expect(row.description.ar.length).toBeGreaterThan(0);
      expect(row.description.en.length).toBeGreaterThan(0);
      expect(typeof row.schema).toBe('object');
    }
  });

  it('refuses wrong types, and names outside the catalogue are not keys', () => {
    expect(() => parseSetting('decisions.escalation_hours', 'soon')).toThrow();
    expect(() => parseSetting('security.totp_required_roles', ['wizard'])).toThrow();
    expect(() => parseSetting('digest.morning_time', '25:00')).toThrow();
    expect(isSettingKey('toString')).toBe(false);
    expect(isSettingKey('nope')).toBe(false);
    expect(settingDefault('decisions.reminder_offsets_hours')).toEqual([24, 2]);
  });
});
