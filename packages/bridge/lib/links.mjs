/**
 * @file The folders this device linked, so `uninstall` can take back each folder's `hub` server. They hold no secret.
 */
import { hubPaths, readJson, writePrivateJson } from './paths.mjs';

export function readLinks(system) {
  const links = readJson(hubPaths(system).links);
  return Array.isArray(links) ? links : [];
}

export function recordLink(system, folder, keys) {
  const others = readLinks(system).filter((link) => link.folder !== folder);
  writePrivateJson(hubPaths(system).links, [...others, { folder, keys }]);
}
