/**
 * @file A stand-in for `tailscale serve` (docs/16 D43): HTTPS on a tailnet-like name, forwarded to the web on its bind address.
 * @description Like `tailscale serve`, it terminates TLS, sends `Host` as the address it forwards to, and says where the browser was in
 * `X-Forwarded-Host`, `X-Forwarded-Proto` and `X-Forwarded-For`. The browser reaches the name through Chromium's host resolver rules and
 * accepts the certificate, which is made here for this run (`selfSignedCert`), so no key is kept in the repository. Every browser here is on
 * one machine, so a test names its device's tailnet address in `x-e2e-device`, which becomes `X-Forwarded-For` and goes no further.
 */
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createServer, type Server } from 'node:https';

function length(size: number): Buffer {
  if (size < 0x80) return Buffer.from([size]);
  const bytes: number[] = [];
  for (let rest = size; rest > 0; rest >>= 8) bytes.unshift(rest & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

const tlv = (tag: number, ...parts: Buffer[]) => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), length(body.length), body]);
};
const seq = (...parts: Buffer[]) => tlv(0x30, ...parts);
const set = (...parts: Buffer[]) => tlv(0x31, ...parts);
const integer = (bytes: Buffer) =>
  tlv(0x02, (bytes[0] ?? 0) & 0x80 ? Buffer.concat([Buffer.from([0]), bytes]) : bytes);
const utcTime = (date: Date) =>
  tlv(0x17, Buffer.from(`${date.toISOString().replace(/[-:T]/g, '').slice(2, 14)}Z`, 'ascii'));

function oid(dotted: string): Buffer {
  const [first = 0, second = 0, ...rest] = dotted.split('.').map(Number);
  const bytes = [first * 40 + second];
  for (const part of rest) {
    const chunk = [part & 0x7f];
    for (let value = part >> 7; value > 0; value >>= 7) chunk.unshift((value & 0x7f) | 0x80);
    bytes.push(...chunk);
  }
  return tlv(0x06, Buffer.from(bytes));
}

/** A one-day, self-signed P-256 certificate for `host`, made with Node's own crypto. */
export function selfSignedCert(host: string): { key: string; cert: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const algorithm = seq(oid('1.2.840.10045.4.3.2')); // ecdsa-with-SHA256
  const name = seq(set(seq(oid('2.5.4.3'), tlv(0x0c, Buffer.from(host, 'utf8')))));
  const serial = randomBytes(8);
  serial[0] = (serial[0] ?? 0) & 0x7f;
  const now = Date.now();
  const subjectAltName = seq(oid('2.5.29.17'), tlv(0x04, seq(tlv(0x82, Buffer.from(host, 'ascii')))));
  const tbs = seq(
    tlv(0xa0, integer(Buffer.from([2]))),
    integer(serial),
    algorithm,
    name,
    seq(utcTime(new Date(now - 3_600_000)), utcTime(new Date(now + 86_400_000))),
    name,
    publicKey.export({ type: 'spki', format: 'der' }),
    tlv(0xa3, seq(subjectAltName)),
  );
  const signature = sign('sha256', tbs, { key: privateKey, dsaEncoding: 'der' });
  const der = seq(tbs, algorithm, tlv(0x03, Buffer.concat([Buffer.from([0]), signature])));
  const body =
    der
      .toString('base64')
      .match(/.{1,64}/g)
      ?.join('\n') ?? '';
  return {
    key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    cert: `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`,
  };
}

export interface TailnetProxy {
  /** `https://<name>:<port>`, what HUB_PUBLIC_URL is set to. */
  readonly url: string;
  /** The Chromium flag that sends the name to this machine. */
  readonly resolverRule: string;
  close(): Promise<void>;
}

/** HTTPS at `name:port`, forwarded to `http://127.0.0.1:<targetPort>` as `tailscale serve` forwards to Hub's web. */
export async function startTailnetProxy(
  name: string,
  port: number,
  targetPort: number,
): Promise<TailnetProxy> {
  const server: Server = createServer(selfSignedCert(name), (incoming, outgoing) => {
    const target = `127.0.0.1:${targetPort}`;
    const { 'x-e2e-device': device, ...headers } = incoming.headers;
    const upstream = httpRequest(
      {
        host: '127.0.0.1',
        port: targetPort,
        method: incoming.method,
        path: incoming.url,
        headers: {
          ...headers,
          host: target,
          'x-forwarded-host': incoming.headers.host ?? `${name}:${port}`,
          'x-forwarded-proto': 'https',
          'x-forwarded-for':
            (typeof device === 'string' && device) || (incoming.socket.remoteAddress ?? '127.0.0.1'),
        },
      },
      (answer) => {
        outgoing.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(outgoing);
      },
    );
    upstream.on('error', () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(upstream);
  });
  await new Promise<void>((done) => server.listen(port, '127.0.0.1', done));
  return {
    url: `https://${name}:${port}`,
    resolverRule: `--host-resolver-rules=MAP ${name} 127.0.0.1`,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
