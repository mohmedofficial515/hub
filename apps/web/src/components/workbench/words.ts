/**
 * @file words.ts
 * @description The panel's catalog as a type, from the English file, which a test holds to the Arabic one. All of it lives in `messages/{ar,en}/chat.json`: engine words at the top, the panel's under `panel`, and the rich tooltip's under `tips`.
 */
import type chatCatalog from '../../../messages/en/chat.json';

export type ChatMessages = typeof chatCatalog;
export type PanelWords = ChatMessages['panel'];
