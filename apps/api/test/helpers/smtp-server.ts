/**
 * @file A mail server for tests: it speaks enough SMTP for nodemailer, with AUTH PLAIN and LOGIN, and keeps every message.
 * @description Plain TCP on 127.0.0.1, so a run never reaches a real inbox or the owner's Mailpit (7342). With `user` and `pass` it
 * refuses a wrong login with 535, as Gmail does. `apps/web/e2e/support/smtp-server.ts` is its twin on the browser tests' side.
 */
import { createServer, type Socket } from 'node:net';

export interface CapturedMail {
  readonly from: string;
  readonly to: readonly string[];
  /** Who logged in, or null with no AUTH. */
  readonly user: string | null;
  readonly subject: string;
  readonly text: string;
}

export interface TestSmtp {
  readonly port: number;
  readonly mails: CapturedMail[];
  close(): Promise<void>;
}

/** `=?UTF-8?B?…?=` and `=?UTF-8?Q?…?=` words, as nodemailer writes a subject that is not ASCII. */
function decodeWords(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?utf-8\?([bq])\?([^?]*)\?=/gi, (_, kind: string, text: string) =>
      kind.toLowerCase() === 'b'
        ? Buffer.from(text, 'base64').toString('utf8')
        : decodeQuoted(text.replace(/_/g, ' ')),
    );
}

function decodeQuoted(text: string): string {
  const bytes: number[] = [];
  const clean = text.replace(/=\r?\n/g, '');
  for (let index = 0; index < clean.length; index += 1) {
    const hex = clean.slice(index + 1, index + 3);
    if (clean[index] === '=' && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      index += 2;
    } else bytes.push(...Buffer.from(clean[index] ?? '', 'utf8'));
  }
  return Buffer.from(bytes).toString('utf8');
}

function parse(data: string): { subject: string; text: string } {
  const split = data.indexOf('\r\n\r\n');
  const head = data.slice(0, split).replace(/\r\n[ \t]+/g, ' ');
  const body = data.slice(split + 4);
  const header = (name: string) => new RegExp(`^${name}:\\s*(.*)$`, 'im').exec(head)?.[1]?.trim() ?? '';
  const encoding = header('Content-Transfer-Encoding').toLowerCase();
  const text =
    encoding === 'base64'
      ? Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
      : encoding === 'quoted-printable'
        ? decodeQuoted(body)
        : body;
  return { subject: decodeWords(header('Subject')), text: text.replace(/\r\n/g, '\n').trim() };
}

export async function startTestSmtp(login: { user: string; pass: string } | null = null): Promise<TestSmtp> {
  const mails: CapturedMail[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => socket.destroy());
    let buffer = '';
    let user: string | null = null;
    let from = '';
    let to: string[] = [];
    let data: string[] | null = null;
    let pending: ((line: string) => void) | null = null;
    const say = (line: string) => socket.write(`${line}\r\n`);
    const check = (name: string, pass: string) => {
      if (login && (name !== login.user || pass !== login.pass)) {
        say('535 5.7.8 Username and Password not accepted');
        return;
      }
      user = name;
      say('235 2.7.0 Accepted');
    };
    const plain = (encoded: string) => {
      const [, name = '', pass = ''] = Buffer.from(encoded, 'base64').toString('utf8').split('\0');
      check(name, pass);
    };
    const handle = (line: string) => {
      if (data) {
        if (line === '.') {
          mails.push({ from, to, user, ...parse(data.join('\r\n')) });
          data = null;
          say('250 2.0.0 Queued');
        } else data.push(line.startsWith('..') ? line.slice(1) : line);
        return;
      }
      if (pending) {
        const next = pending;
        pending = null;
        next(line);
        return;
      }
      const [verb = '', ...rest] = line.split(' ');
      const argument = rest.join(' ');
      switch (verb.toUpperCase()) {
        case 'EHLO':
          say('250-test.smtp');
          say('250-AUTH PLAIN LOGIN');
          say('250 8BITMIME');
          return;
        case 'HELO':
          return say('250 test.smtp');
        case 'AUTH': {
          const [mechanism = '', initial] = argument.split(' ');
          if (mechanism.toUpperCase() === 'PLAIN') {
            if (initial) return plain(initial);
            pending = plain;
            return say('334 ');
          }
          if (mechanism.toUpperCase() === 'LOGIN') {
            const askPassword = (name: string) => {
              pending = (pass) => check(name, Buffer.from(pass, 'base64').toString('utf8'));
              say('334 UGFzc3dvcmQ6');
            };
            if (initial) return askPassword(Buffer.from(initial, 'base64').toString('utf8'));
            pending = (encoded) => askPassword(Buffer.from(encoded, 'base64').toString('utf8'));
            return say('334 VXNlcm5hbWU6');
          }
          return say('504 5.5.4 Unknown mechanism');
        }
        case 'MAIL':
          if (login && !user) return say('530 5.7.0 Authentication required');
          from = /<([^>]*)>/.exec(argument)?.[1] ?? '';
          to = [];
          return say('250 2.1.0 OK');
        case 'RCPT':
          to.push(/<([^>]*)>/.exec(argument)?.[1] ?? '');
          return say('250 2.1.5 OK');
        case 'DATA':
          data = [];
          return say('354 End data with <CR><LF>.<CR><LF>');
        case 'RSET':
          from = '';
          to = [];
          return say('250 2.0.0 OK');
        case 'NOOP':
          return say('250 2.0.0 OK');
        case 'QUIT':
          say('221 2.0.0 Bye');
          socket.end();
          return;
        default:
          return say('502 5.5.2 Not implemented');
      }
    };
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      for (let end = buffer.indexOf('\r\n'); end >= 0; end = buffer.indexOf('\r\n')) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        handle(line);
      }
    });
    say('220 test.smtp ESMTP');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    port,
    mails,
    close: () =>
      new Promise<void>((done) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => done());
      }),
  };
}
