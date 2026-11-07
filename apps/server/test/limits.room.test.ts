import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Room, Server, type Client } from '@colyseus/core';
import { Client as SdkClient, type Room as SdkRoom } from '@colyseus/sdk';
import WebSocket from 'ws';
import { MessageGuard, guarded } from '../src/net/guard.js';
import { LIMITS } from '../src/net/limits.js';
import { createTransport } from '../src/net/transport.js';

const GOOD_ORIGIN = 'http://localhost:5198';

class EchoRoom extends Room {
  private guard = new MessageGuard();
  onCreate() {
    this.onMessage(
      'echo',
      guarded(this.guard, (c: Client, m: unknown) => c.send('echo', m)),
    );
    this.onMessage('*', guarded(this.guard, () => {}));
  }
  onLeave(client: Client) {
    this.guard.forget(client.sessionId);
  }
}

let port = 0;
let server: Server;
const open: SdkRoom[] = [];

const wait = async (cond: () => boolean, ms = 3000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('hết giờ chờ');
    await new Promise((r) => setTimeout(r, 10));
  }
};

const join = async () => {
  const room = await new SdkClient(`ws://localhost:${port}`).joinOrCreate('echo');
  open.push(room);
  const echoes: unknown[] = [];
  let closed: number | null = null;
  room.onMessage('echo', (m: unknown) => echoes.push(m));
  room.onLeave((code: number) => {
    closed = code;
  });
  return { room, echoes, closedCode: () => closed };
};

beforeAll(async () => {
  const http = createServer();
  server = new Server({
    transport: createTransport({
      server: http,
      maxPayloadBytes: LIMITS.wsMaxPayloadBytes,
      allowedOrigins: [GOOD_ORIGIN],
      allowMissingOrigin: true,
    }),
  });
  server.define('echo', EchoRoom);
  await server.listen(0);
  port = (http.address() as AddressInfo).port;
});

afterAll(async () => {
  await Promise.race([
    Promise.allSettled(open.map((r) => r.leave())),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
  await server.gracefullyShutdown(false);
});

describe('giới hạn mạng của room', () => {
  it('(a) tin 2 KiB được echo', async () => {
    const a = await join();
    const body = 'a'.repeat(2048);
    a.room.send('echo', body);
    await wait(() => a.echoes.length === 1);
    expect(a.echoes[0]).toBe(body);
  });

  it('(b) tin 8 KiB làm đóng kết nối client đó, server vẫn sống', async () => {
    const bad = await join();
    const good = await join();
    bad.room.send('echo', 'x'.repeat(8192));
    await wait(() => bad.closedCode() !== null, 3000);
    expect(good.closedCode()).toBeNull();
    good.room.send('echo', 'ping');
    await wait(() => good.echoes.length === 1);
    expect(good.echoes[0]).toBe('ping');
  });

  it('(c) 200 tin dồn: echo ≤ 22 và client bị đóng với mã 4029', async () => {
    const spam = await join();
    for (let i = 0; i < 200; i++) spam.room.send('echo', i);
    await wait(() => spam.closedCode() !== null, 3000);
    expect(spam.closedCode()).toBe(4029);
    expect(spam.echoes.length).toBeLessThanOrEqual(22);
    expect(spam.echoes.length).toBeGreaterThanOrEqual(1);
  });

  const handshake = (origin: string) =>
    new Promise<'rejected' | 'opened'>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}/x`, { origin });
      ws.on('unexpected-response', (_req, res) => {
        expect(res.statusCode).toBe(403);
        resolve('rejected');
      });
      ws.on('open', () => {
        resolve('opened');
        ws.close();
      });
      ws.on('error', reject);
    });

  it('(d) Origin lạ bị từ chối ở bắt tay, Origin hợp lệ thì qua', async () => {
    expect(await handshake('http://evil.example')).toBe('rejected');
    expect(await handshake(GOOD_ORIGIN)).toBe('opened');
  });
});
