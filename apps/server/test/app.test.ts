import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createMemoryDocDb } from '../src/persist/memory-docdb.js';
import { createApp, type AppContext } from '../src/app.js';
import { ConfigError, loadConfig, type Config } from '../src/config.js';
import { startServer } from '../src/index.js';
import { seedDevCampus } from '../src/rooms/campus-dev-seed.js';
import type { IdTokenChecker } from '../src/auth/verifier.js';
import type { Logger } from '../src/ports.js';

process.setMaxListeners(100);

const devConfig = (extra: Record<string, string> = {}): Config => loadConfig({ NODE_ENV: 'test', PORT: '0', ...extra });
const quiet: Logger = { info: () => {}, error: () => {} };

type Started = Awaited<ReturnType<typeof startServer>>;
const running: Started[] = [];
async function boot(config = devConfig(), docDb = createMemoryDocDb()) {
  const app = await createApp(config, { docDb, log: quiet });
  const s = await startServer(0, { config, app });
  running.push(s);
  const url = `http://localhost:${(s.http.address() as AddressInfo).port}`;
  return { ...s, app, docDb, url };
}
afterEach(async () => {
  for (const s of running.splice(0)) await s.server.gracefullyShutdown(false);
});

const auth = (label: string) => ({ authorization: `Bearer dev:${label}`, 'content-type': 'application/json' });

describe('app', () => {
  it('GET /health → 200 ok', async () => {
    const { url } = await boot();
    const res = await fetch(`${url}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('POST /v1/me bằng dev:alice → 201', async () => {
    const { url } = await boot();
    const res = await fetch(`${url}/v1/me`, { method: 'POST', headers: auth('alice'), body: JSON.stringify({ displayName: 'Alice' }) });
    expect(res.status).toBe(201);
    expect(((await res.json()) as any).displayName).toBe('Alice');
  });

  it('khởi động lại với cùng DocDb: user và identity còn', async () => {
    const docDb = createMemoryDocDb();
    const first = await boot(devConfig(), docDb);
    const res = await fetch(`${first.url}/v1/me`, { method: 'POST', headers: auth('alice'), body: JSON.stringify({ displayName: 'Alice' }) });
    const { id } = (await res.json()) as any;
    await first.server.gracefullyShutdown(false);
    running.length = 0;

    const again = await createApp(devConfig(), { docDb, log: quiet });
    expect(again.identities.get('dev:alice')?.userId).toBe(id);
    expect(again.store.users.get(id)?.displayName).toBe('Alice');
    expect(again.devUserId('alice')).toBe(id);
  });

  it('nạp được ≥ 6 bài học', async () => {
    const app = await createApp(devConfig(), { log: quiet });
    expect(app.lessonIds.length).toBeGreaterThanOrEqual(6);
  });

  it('CORS: Origin hợp lệ có header, Origin lạ thì không; OPTIONS → 204', async () => {
    const { url } = await boot();
    const ok = await fetch(`${url}/v1/me`, { method: 'OPTIONS', headers: { origin: 'http://localhost:5180' } });
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5180');
    expect(ok.headers.get('access-control-allow-headers')).toMatch(/Authorization/);
    expect(ok.headers.get('access-control-allow-headers')).toMatch(/Content-Type/);

    const bad = await fetch(`${url}/v1/me`, { method: 'OPTIONS', headers: { origin: 'http://evil.example' } });
    expect(bad.status).toBe(204);
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();

    const badPost = await fetch(`${url}/campus/seat`, { method: 'POST', headers: { ...auth('alice'), origin: 'http://evil.example' }, body: '{}' });
    expect(badPost.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('CORS credentials trên /matchmake: chỉ Origin trong allowlist mới có ACAO + ACAC', async () => {
    const { url } = await boot();
    const origin = 'http://localhost:5180';
    for (const method of ['OPTIONS', 'POST']) {
      const init = (o?: string): RequestInit => ({
        method,
        headers: { ...(o ? { origin: o } : {}), 'content-type': 'application/json' },
        ...(method === 'POST' ? { body: '{}' } : {}),
      });
      const ok = await fetch(`${url}/matchmake/joinById/x`, init(origin));
      expect(ok.headers.get('access-control-allow-origin'), method).toBe(origin);
      expect(ok.headers.get('access-control-allow-credentials'), method).toBe('true');
      expect(ok.headers.get('vary') ?? '', method).toMatch(/Origin/i);

      for (const o of ['http://evil.example', undefined]) {
        const res = await fetch(`${url}/matchmake/joinById/x`, init(o));
        expect(res.headers.get('access-control-allow-origin'), `${method} ${o}`).toBeNull();
        expect(res.headers.get('access-control-allow-credentials'), `${method} ${o}`).toBeNull();
      }
    }
  });

  it('body 20 KiB → 413; JSON hỏng → 400 INVALID', async () => {
    const { url } = await boot();
    const big = await fetch(`${url}/v1/me`, { method: 'POST', headers: auth('alice'), body: JSON.stringify({ displayName: 'x'.repeat(20 * 1024) }) });
    expect(big.status).toBe(413);
    const broken = await fetch(`${url}/v1/me`, { method: 'POST', headers: auth('alice'), body: '{"displayName":' });
    expect(broken.status).toBe(400);
    expect(((await broken.json()) as any).error.code).toBe('INVALID');
  });

  it('authenticate("dev:bob") tự tạo người lớn, lần sau cùng một user', async () => {
    const app = await createApp(devConfig(), { log: quiet });
    const [a, b] = await Promise.all([app.authenticate('dev:bob'), app.authenticate('dev:bob')]);
    expect(a.userId).toBe(b.userId);
    expect(app.store.users.get(a.userId)?.ageBand).toBe('adult');
    expect(app.store.users.get(a.userId)?.displayName).toBe('bob');
    expect([...app.store.users.values()].filter((u) => u.displayName === 'bob')).toHaveLength(1);
    expect((await app.authenticate('dev:bob')).userId).toBe(a.userId);
  });

  it('identity trỏ user child → FORBIDDEN', async () => {
    const app = await createApp(devConfig(), { log: quiet });
    app.store.users.set('kid1', { id: 'kid1', displayName: 'Bé', ageBand: 'child', planId: 'free', createdAt: 0 } as never);
    app.identities.set('dev:kid', { uid: 'dev:kid', userId: 'kid1', linkedAt: 0 });
    await expect(app.authenticate('dev:kid')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(() => app.linkDevIdentity('kid', 'kid1')).toThrow();
  });

  it('token sai → AuthError; firebase chưa đăng ký → FORBIDDEN, linkDevIdentity bị cấm', async () => {
    const checker: IdTokenChecker = { verifyIdToken: async () => ({ uid: 'fb-1' }) };
    const app = await createApp(devConfig({ AUTH_MODE: 'firebase', FIREBASE_PROJECT_ID: 'demo' }), { log: quiet, idTokenChecker: checker });
    await expect(app.authenticate('whatever')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(app.authenticate(undefined)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const adult = app.service.registerUser({ displayName: 'A' });
    expect(() => app.linkDevIdentity('abc', adult.id)).toThrow();
  });

  it('linkDevIdentity: nhãn sai bị từ chối', async () => {
    const app = await createApp(devConfig(), { log: quiet });
    const adult = app.service.registerUser({ displayName: 'A' });
    expect(() => app.linkDevIdentity('Bad Label', adult.id)).toThrow();
    app.linkDevIdentity('good-1', adult.id);
    expect(app.devUserId('good-1')).toBe(adult.id);
  });

  it('production + AUTH_MODE=dev không khởi động được', async () => {
    const env = { NODE_ENV: 'production', AUTH_MODE: 'dev', STORE: 'firestore', ALLOWED_ORIGINS: 'https://x.example', FIREBASE_PROJECT_ID: 'p' };
    expect(() => loadConfig(env)).toThrow(ConfigError);
    const hand: Config = { ...devConfig(), nodeEnv: 'production', auth: 'dev' };
    await expect(createApp(hand, { docDb: createMemoryDocDb(), log: quiet })).rejects.toThrow();
  });

  it('seed chạy 2 lần không nhân đôi user', async () => {
    const { app } = await boot();
    const n = app.store.users.size;
    expect(n).toBeGreaterThanOrEqual(30);
    await seedDevCampus(app as AppContext);
    expect(app.store.users.size).toBe(n);
  });
});
