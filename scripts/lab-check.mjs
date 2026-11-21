/**
 * @file `pnpm lab:check`, and the check `pnpm start:local` runs once the lab is up (docs/16 §6).
 * @description Asks the running lab to transform every source file of every version, so a broken one is named at start. It only reports: the lab
 * compiles each version on demand, so a broken version fails in its own frame and nothing else stops. Exit code 1 means a version has an error.
 */
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APPS = ['web', 'dashboard', 'hub'];
const SOURCE = /\.tsx?$/;
const SKIP = new Set(['review', 'research', 'shots', 'node_modules', 'port']);
const PARALLEL = 4;

/** Source files of a version, without what is only ever read by people. */
function sourcesOf(folder) {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return SKIP.has(name) ? [] : sourcesOf(path);
    return SOURCE.test(name) ? [path] : [];
  });
}

/** Every version that renders: a folder with a `page.tsx`, under `<app>/<page>/`. */
export function versionsIn(labDir) {
  const versions = [];
  for (const app of APPS) {
    const appDir = join(labDir, app);
    if (!existsSync(appDir)) continue;
    for (const page of readdirSync(appDir)) {
      const pageDir = join(appDir, page);
      if (!statSync(pageDir).isDirectory()) continue;
      for (const version of readdirSync(pageDir)) {
        const folder = join(pageDir, version);
        if (statSync(folder).isDirectory() && existsSync(join(folder, 'page.tsx'))) {
          versions.push({ id: `${app}/${page}/${version}`, folder });
        }
      }
    }
  }
  return versions;
}

/** The first line of what the server said, without its colours. */
const firstLine = (text) =>
  text
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 300) ?? 'no message';

async function checkFile(origin, file) {
  const path = file.split('\\').join('/');
  const response = await fetch(`${origin}/lab/@fs/${path.replace(/^\//, '')}`);
  if (response.ok) return null;
  return `${response.status}: ${firstLine(await response.text())}`;
}

/** `{ versions, files, broken: [{ id, file, error }] }`. Never throws for a version: only for a lab that does not answer. */
export async function checkVersions({ origin, labDir }) {
  const versions = versionsIn(labDir);
  const jobs = versions.flatMap((version) => sourcesOf(version.folder).map((file) => ({ version, file })));
  const broken = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next];
      next += 1;
      const error = await checkFile(origin, job.file);
      if (error) broken.push({ id: job.version.id, file: relative(labDir, job.file), error });
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  return { versions: versions.length, files: jobs.length, broken };
}

/** One line for a person, and the detail in a file. */
export function describe(result, logFile) {
  if (logFile) {
    const lines = result.broken.map((item) => `${item.id}  ${item.file}\n  ${item.error}\n`);
    writeFileSync(logFile, lines.join('\n') || 'No errors.\n');
  }
  if (result.broken.length === 0) return `Lab: ${result.versions} versions compile.`;
  const names = [...new Set(result.broken.map((item) => item.id))];
  return `Lab: ${names.length} of ${result.versions} versions have errors, each in its own frame only: ${names.join(', ')}.${
    logFile ? ` Detail: ${logFile}` : ''
  }`;
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const port = process.env.LAB_PORT ?? '7320';
  const result = await checkVersions({ origin: `http://127.0.0.1:${port}`, labDir: join(root, 'apps/lab') });
  process.stdout.write(`${describe(result)}\n`);
  for (const item of result.broken) process.stdout.write(`  ${item.file}: ${item.error}\n`);
  process.exitCode = result.broken.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`The lab did not answer on its port. Is it running? ${String(error)}\n`);
    process.exitCode = 2;
  });
}
