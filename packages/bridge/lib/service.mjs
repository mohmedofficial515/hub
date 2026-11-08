/**
 * @file The running bridge: one outbound socket to Hub, kept up for as long as this device is paired (docs/16 §4).
 * @description It says who it is, sends a heartbeat, holds the folder list Hub sends, and answers actions through `dispatch`. A dropped connection retries with a backoff, because Hub may simply be off.
 * A revoked device stops for good: it exits and leaves its files, and `uninstall` or a new `connect` is the owner's next step. Frames are never logged, as they can hold anything a chat holds.
 */
import { rmSync, writeFileSync } from 'node:fs';

import { dispatch } from './actions.mjs';
import { resolveClaude } from './claude.mjs';
import { createLog } from './log.mjs';
import { hubPaths, readJson } from './paths.mjs';
import {
  BRIDGE_ACTIONS,
  BRIDGE_CLOSE,
  BRIDGE_PROTOCOL_VERSION,
  BRIDGE_SOCKET_PATH,
  BRIDGE_VERSION,
} from './protocol.mjs';
import { turnManager } from './turns.mjs';
import { resolveVsCode } from './vscode.mjs';

const HEARTBEAT_MS = 25_000;
const STATUS_REFRESH_MS = 5 * 60_000;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** A connection still not open by now is given up and tried again, so a socket that never answers cannot stall the loop. */
const CONNECT_TIMEOUT_MS = 20_000;

export function socketUrl(url) {
  return `${url.replace(/^http/, 'ws')}${BRIDGE_SOCKET_PATH}`;
}

export function createBridge(system, device) {
  const log = createLog(hubPaths(system).log);
  let folders = [];
  let docRoots = [];
  let socket = null;
  let heartbeat = null;
  let stopped = false;
  let backoff = BACKOFF_MIN_MS;
  let failing = false;
  let status = { bridgeVersion: BRIDGE_VERSION };
  let statusAt = 0;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const context = { system, url: device.url, folders: () => folders, docRoots: () => docRoots };

  async function refreshStatus() {
    if (Date.now() - statusAt < STATUS_REFRESH_MS) return status;
    statusAt = Date.now();
    const [claude, vscode] = await Promise.all([resolveClaude(system), resolveVsCode(system)]);
    status = {
      bridgeVersion: BRIDGE_VERSION,
      claudeVersion: claude.best?.version ?? null,
      vscodeFound: vscode.found,
    };
    return status;
  }

  function send(target, frame) {
    if (target.readyState === 1) target.send(JSON.stringify(frame));
  }

  async function onAction(target, frame) {
    let seq = 0;
    const emit = (kind, data) => send(target, { type: 'event', id: frame.id, seq: seq++, kind, data });
    const answer = await dispatch(frame, context, emit);
    send(target, { type: 'result', id: frame.id, ...answer });
  }

  function onMessage(target, raw) {
    let frame;
    try {
      frame = JSON.parse(String(raw));
    } catch {
      log('A frame that is not JSON was dropped');
      return;
    }
    if (frame.type === 'welcome') {
      folders = Array.isArray(frame.folders) ? frame.folders : [];
      docRoots = Array.isArray(frame.docRoots) ? frame.docRoots : [];
      backoff = BACKOFF_MIN_MS;
      failing = false;
      log(`Connected as device ${frame.deviceId}, ${folders.length} folders`);
    } else if (frame.type === 'allowlist') {
      folders = Array.isArray(frame.folders) ? frame.folders : [];
      docRoots = Array.isArray(frame.docRoots) ? frame.docRoots : [];
    } else if (frame.type === 'action') {
      void onAction(target, frame);
    }
  }

  function finish(code) {
    stopped = true;
    if (heartbeat) clearInterval(heartbeat);
    turnManager(context)
      .shutdown()
      .finally(() => resolveDone(code));
  }

  function retry() {
    if (stopped) return;
    if (!failing) log('Hub cannot be reached. Trying again every 30 seconds at most.');
    failing = true;
    const wait = backoff + Math.floor(Math.random() * 500);
    backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
    setTimeout(open, wait).unref?.();
  }

  function open() {
    if (stopped) return;
    const target = new system.WebSocket(socketUrl(device.url), {
      headers: { authorization: `Bearer ${device.credential}` },
    });
    socket = target;
    // Each socket ends once. Node's own WebSocket fires `error` and never `close` when the connection is refused or the answer is not a 101,
    // so an `error` before `open` ends the attempt here too, or the loop would stop with nothing in the log (seen 2026-11-08).
    let ended = false;
    const end = (code) => {
      if (ended) return false;
      ended = true;
      clearTimeout(watchdog);
      if (heartbeat) clearInterval(heartbeat);
      // Nobody can answer an approval or see the reply now, and the API has already marked these interrupted.
      if (socket === target) turnManager(context).stopAll();
      if (code === BRIDGE_CLOSE.revoked) {
        log('This device was revoked. Stopping.');
        finish(0);
      } else if (code === BRIDGE_CLOSE.replaced) {
        log('Another bridge took over for this device. Stopping.');
        finish(0);
      } else if (code === BRIDGE_CLOSE.unsupportedProtocol) {
        log('Hub uses another protocol version. Run the connect command again.');
        finish(1);
      } else {
        retry();
      }
      return true;
    };
    const abandon = () => {
      if (!end(1006)) return;
      try {
        target.close();
      } catch {
        /* A socket still connecting may refuse to close, and it is dropped either way. */
      }
    };
    const watchdog = setTimeout(() => {
      if (target.readyState === 0) abandon();
    }, CONNECT_TIMEOUT_MS);
    watchdog.unref?.();
    target.addEventListener('open', async () => {
      clearTimeout(watchdog);
      send(target, {
        type: 'hello',
        protocol: BRIDGE_PROTOCOL_VERSION,
        status: await refreshStatus(),
        actions: BRIDGE_ACTIONS,
      });
      if (ended) return;
      heartbeat = setInterval(async () => {
        send(target, { type: 'heartbeat', status: await refreshStatus() });
      }, HEARTBEAT_MS);
    });
    target.addEventListener('message', (event) => onMessage(target, event.data));
    target.addEventListener('error', () => {
      // Once open, `close` follows with the real code. While still connecting, it may never come.
      if (target.readyState === 0) abandon();
    });
    target.addEventListener('close', (event) => end(event.code));
  }

  return {
    start() {
      open();
      return done;
    },
    stop() {
      socket?.close();
      finish(0);
    },
    folders: () => folders,
  };
}

/** `hub-bridge run`. One bridge per device: a second start leaves the first alone. */
export async function runBridge(system) {
  const paths = hubPaths(system);
  const device = readJson(paths.device);
  if (!device?.credential || !device.url) {
    system.out('This device is not paired. Run the connect command from Settings › Devices.');
    return 1;
  }
  const existing = readJson(paths.pid);
  if (existing?.pid && existing.pid !== process.pid && isAlive(existing.pid)) {
    system.out(`The bridge is already running (process ${existing.pid}).`);
    return 0;
  }
  writeFileSync(paths.pid, JSON.stringify({ pid: process.pid }));
  const bridge = createBridge(system, device);
  const keepAlive = setInterval(() => {}, 60_000);
  const code = await bridge.start();
  clearInterval(keepAlive);
  rmSync(paths.pid, { force: true });
  return code;
}

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Stops this device's bridge. On Windows a whole tree needs `taskkill`, and a bare kill would leave children (S1 Q7). */
export async function stopRunningBridge(system) {
  const paths = hubPaths(system);
  const pid = readJson(paths.pid)?.pid;
  if (pid && pid !== process.pid && isAlive(pid)) {
    if (system.platform === 'win32') {
      await system.run('taskkill.exe', ['/PID', String(pid), '/T', '/F']);
    } else {
      try {
        process.kill(pid);
      } catch {
        /* Already gone. */
      }
    }
  }
  rmSync(paths.pid, { force: true });
}
