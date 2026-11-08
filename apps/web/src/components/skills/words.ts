/**
 * @file words.ts
 * @description The Skills page's catalog as a type, from the English file; a test holds the Arabic one to it. Everything lives in `messages/{ar,en}/skills.json`.
 */
import type catalog from '../../../messages/en/skills.json';

export type SkillsMessages = typeof catalog;
