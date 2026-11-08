/**
 * @file words.ts
 * @description The agent queue's catalog as a type, from the English file; a test holds the Arabic one to it. Page, dialog, sheet section and the settings tab all read `messages/{ar,en}/queue.json`.
 */
import type catalog from '../../../messages/en/queue.json';

export type QueueMessages = typeof catalog;
