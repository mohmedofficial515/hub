/**
 * @file words.ts
 * @description The Skills page's catalog as a type, from the English file; a test holds the Arabic one to it. Everything lives in `messages/{ar,en}/skills.json`.
 * `builtIn` holds a short description of each of Hub's own skills, by name, in the UI's language (knowledge-05). The English entries are empty on purpose: the skill's own
 * description is already English, so an empty entry means "show the skill's own text". A skill the owner made, or a personal one, always keeps its own text.
 */
import type catalog from '../../../messages/en/skills.json';

export type SkillsMessages = typeof catalog;

/** What a card and the skill's page show as when Claude uses it: Hub's short description in the UI's language for one of its own skills, else the skill's own text. */
export function describeSkill(
  skill: { name: string; description: string; core: boolean; source: string },
  builtIn: SkillsMessages['builtIn'],
): { text: string; translated: boolean } {
  const local =
    skill.source === 'hub' && skill.core ? (builtIn as Record<string, string | undefined>)[skill.name] : '';
  return local ? { text: local, translated: true } : { text: skill.description, translated: false };
}
