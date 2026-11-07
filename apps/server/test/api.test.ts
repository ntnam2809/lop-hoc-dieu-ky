import { describe, expect, it } from 'vitest';
import { RateLimiter, SchoolService, createMemoryStore, type ActivityResult } from '@lhdk/domain';
import { createApi, type ApiResponse } from '../src/http/api.js';
import { createIds } from '../src/ids.js';
import { createLogger } from '../src/log.js';
import { AuthError, type AuthVerifier, type Identity } from '../src/ports.js';

function setup(opts: { signup?: (uid: string) => boolean; flushFails?: boolean } = {}) {
  const store = createMemoryStore();
  let t = 1_000;
  const clock = () => t;
  const service = new SchoolService({ store, clock, ids: createIds(store) });
  const identities = new Map<string, Identity>();
  const lines: string[] = [];
  const state = { flushes: 0, flushFails: opts.flushFails ?? false };
  const verifier: AuthVerifier = {
    async verify(token) {
      if (!token.startsWith('tok-')) throw new AuthError();
      return { uid: token.slice(4), provider: 'dev' };
    },
  };
  const api = createApi({
    service,
    verifier,
    flush: async () => {
      state.flushes++;
      if (state.flushFails) throw new Error('boom');
    },
    identities,
    signupAllowed: opts.signup ?? (() => true),
    clock,
    log: createLogger((l) => lines.push(l), clock),
    limiter: new RateLimiter(10, 1 / 2000),
  });
  const call = (uid: string | null, method: string, path: string, body?: unknown) =>
    api({ method, path, headers: uid === null ? {} : { authorization: `Bearer tok-${uid}` }, body });
  return { store, service, identities, lines, state, call, api, advance: (ms: number) => (t += ms) };
}

const errCode = (r: ApiResponse) => (r.body as { error: { code: string } }).error.code;

describe('API HTTP MVP-A', () => {
  it('hành trình người lớn: đăng ký → lập trường → cấp giáo viên → mở lớp → vào lớp bằng mã → xem tiến độ', async () => {
    const s = setup();
    const a = await s.call('alice', 'POST', '/v1/me', { displayName: 'Cô Lan' });
    const b = await s.call('bob', 'POST', '/v1/me', { displayName: 'Anh Bình' });
    const c = await s.call('carol', 'POST', '/v1/me', { displayName: 'Chị Cúc' });
    expect([a.status, b.status, c.status]).toEqual([201, 201, 201]);
    const aliceId = (a.body as { id: string }).id;
    const bobId = (b.body as { id: string }).id;
    const carolId = (c.body as { id: string }).id;
    expect(a.body).toEqual({ id: aliceId, displayName: 'Cô Lan', planId: 'free' });

    const me = await s.call('alice', 'GET', '/v1/me');
    expect(me).toEqual({ status: 200, body: { id: aliceId, displayName: 'Cô Lan', planId: 'free' } });

    s.store.users.get(aliceId)!.planId = 'pilot'; // cấp tay gói pilot

    const school = await s.call('alice', 'POST', '/v1/schools', { name: 'Trường Hoa', level: 'primary' });
    expect(school.status).toBe(201);
    const schoolId = (school.body as { id: string; kind: string }).id;
    expect((school.body as { kind: string }).kind).toBe('play');

    expect((await s.call('alice', 'POST', `/v1/schools/${schoolId}/teachers`, { userId: bobId })).status).toBe(204);
    const cls = await s.call('bob', 'POST', `/v1/schools/${schoolId}/classes`, { name: 'Lớp Một', capacity: 5 });
    expect(cls.status).toBe(201);
    const { id: classId, joinCode } = cls.body as { id: string; joinCode: string };
    expect(joinCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

    const enr = await s.call('carol', 'POST', '/v1/enrollments', { joinCode });
    expect(enr).toEqual({ status: 201, body: { classId } });

    const result: ActivityResult = {
      sessionId: 'ss1', classId, lessonId: 'l1', userId: carolId, activityId: 'a1',
      response: { kind: 'done' }, outcome: 'correct', attempts: 1, at: 1,
    };
    s.store.results.set('ss1:carol:a1', result);
    const prog = await s.call('bob', 'GET', `/v1/classes/${classId}/progress`);
    expect(prog.status).toBe(200);
    expect(prog.body).toEqual([result]);

    expect((await s.call('alice', 'GET', `/v1/schools/${schoolId}/reports`)).status).toBe(200);
    const audit = await s.call('alice', 'GET', `/v1/schools/${schoolId}/audit`);
    expect(audit.status).toBe(200);
    expect((audit.body as unknown[]).length).toBeGreaterThan(0);

    expect((await s.call('alice', 'DELETE', `/v1/schools/${schoolId}/teachers/${bobId}`)).status).toBe(204);
    // 3 đăng ký + 1 trường + 1 cấp + 1 lớp + 1 enroll + 1 thu hồi = 8 lệnh ghi → 8 lần flush; đọc không flush
    expect(s.state.flushes).toBe(8);
  });

  it('401 khi thiếu hoặc sai token; không lộ gì thêm', async () => {
    const s = setup();
    const r1 = await s.call(null, 'GET', '/v1/me');
    expect(r1.status).toBe(401);
    expect(errCode(r1)).toBe('UNAUTHENTICATED');
    const r2 = await s.api({ method: 'GET', path: '/v1/me', headers: { authorization: 'Bearer nope' }, body: undefined });
    expect(r2.status).toBe(401);
    const r3 = await s.api({ method: 'GET', path: '/v1/me', headers: { authorization: 'Basic abc' }, body: undefined });
    expect(r3.status).toBe(401);
  });

  it('403 NOT_REGISTERED khi chưa có hồ sơ (trừ POST /v1/me)', async () => {
    const s = setup();
    const r = await s.call('zed', 'GET', '/v1/me');
    expect(r.status).toBe(403);
    expect(errCode(r)).toBe('NOT_REGISTERED');
    const w = await s.call('zed', 'POST', '/v1/schools', { name: 'X', level: 'primary' });
    expect(errCode(w)).toBe('NOT_REGISTERED');
  });

  it('POST /v1/me với ageBand/planId/platformAdmin/key lạ → 400 và không tạo user', async () => {
    const s = setup();
    for (const extra of [{ ageBand: 'child' }, { platformAdmin: true }, { planId: 'pilot' }, { foo: 1 }]) {
      const r = await s.call('kid', 'POST', '/v1/me', { displayName: 'Bé', ...extra });
      expect(r.status).toBe(400);
      expect(errCode(r)).toBe('INVALID');
    }
    expect((await s.call('kid', 'POST', '/v1/me', { displayName: 123 })).status).toBe(400);
    expect((await s.call('kid', 'POST', '/v1/me', { displayName: 'x'.repeat(61) })).status).toBe(400);
    expect((await s.call('kid', 'POST', '/v1/me')).status).toBe(400);
    expect(s.store.users.size).toBe(0);
    expect(s.identities.size).toBe(0);
    expect(s.state.flushes).toBe(0);
  });

  it('POST /v1/me lần hai → 409; SIGNUP_CLOSED khi không nằm trong danh sách', async () => {
    const s = setup({ signup: (uid) => uid === 'open' });
    expect((await s.call('open', 'POST', '/v1/me', { displayName: 'A' })).status).toBe(201);
    expect((await s.call('open', 'POST', '/v1/me', { displayName: 'A' })).status).toBe(409);
    const closed = await s.call('shut', 'POST', '/v1/me', { displayName: 'B' });
    expect(closed.status).toBe(403);
    expect(errCode(closed)).toBe('SIGNUP_CLOSED');
    expect(s.store.users.size).toBe(1);
  });

  it('identity trỏ tới user child → 403 ADULT_ONLY ở mọi route', async () => {
    const s = setup();
    s.store.users.set('kid1', { id: 'kid1', displayName: 'Bé', ageBand: 'child', planId: 'free', createdAt: 0 });
    s.identities.set('kidUid', { uid: 'kidUid', userId: 'kid1', linkedAt: 0 });
    for (const [m, p, b] of [
      ['GET', '/v1/me', undefined],
      ['GET', '/v1/me/progress', undefined],
      ['POST', '/v1/me', { displayName: 'X' }],
      ['POST', '/v1/enrollments', { joinCode: 'AAAAAAAA' }],
    ] as const) {
      const r = await s.call('kidUid', m, p, b);
      expect(r.status).toBe(403);
      expect(errCode(r)).toBe('ADULT_ONLY');
    }
  });

  it('không có đường tạo trường tổ chức / hồ sơ trẻ / xác minh / phiên / chat', async () => {
    const s = setup();
    await s.call('alice', 'POST', '/v1/me', { displayName: 'Cô Lan' });
    const id = [...s.store.users.keys()][0]!;
    s.store.users.get(id)!.planId = 'pilot';
    const org = await s.call('alice', 'POST', '/v1/schools', { name: 'Tổ chức', level: 'primary', kind: 'organization' });
    expect(org.status).toBe(400);
    expect(s.store.schools.size).toBe(0);
    const before = s.store.users.size;
    for (const [m, p] of [
      ['POST', '/v1/classes/c1/students'],
      ['POST', '/v1/schools/s1/students'],
      ['POST', '/v1/schools/s1/verify'],
      ['POST', '/v1/admin/verify'],
      ['POST', '/v1/classes/c1/sessions'],
      ['POST', '/v1/sessions/x/results'],
      ['POST', '/v1/sessions/x/chat'],
      ['PUT', '/v1/me'],
      ['GET', '/v1/unknown'],
      ['GET', '/v1/me/'],
      ['GET', '/v1/schools/bad id/audit'],
    ] as const) {
      const r = await s.call('alice', m, p, { displayName: 'Bé', ageBand: 'child' });
      expect(r.status, `${m} ${p}`).toBe(404);
    }
    expect(s.store.users.size).toBe(before);
  });

  it('flush lỗi → 503 UNAVAILABLE và log persist.fail', async () => {
    const s = setup();
    s.state.flushFails = true;
    const r = await s.call('alice', 'POST', '/v1/me', { displayName: 'Cô Lan' });
    expect(r.status).toBe(503);
    expect(errCode(r)).toBe('UNAVAILABLE');
    expect(s.lines.some((l) => JSON.parse(l).event === 'persist.fail')).toBe(true);
  });

  it('11 lệnh ghi dồn (hai route) → 429 với limiter dùng chung', async () => {
    const s = setup();
    await s.call('alice', 'POST', '/v1/me', { displayName: 'Cô Lan' }); // khoá uid, chưa tính vào khoá userId
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const r = i % 2 === 0 ? await s.call('alice', 'POST', '/v1/enrollments', { joinCode: 'ZZZZZZZZ' }) : await s.call('alice', 'POST', '/v1/schools', { name: 'T', level: 'primary' });
      statuses.push(r.status);
    }
    // 10 lệnh đầu còn trong burst (lỗi nghiệp vụ 404/422), lệnh thứ 11 bị chặn
    expect(statuses.slice(0, 10).every((x) => x !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(errCode(await s.call('alice', 'POST', '/v1/enrollments', { joinCode: 'ZZZZZZZZ' }))).toBe('RATE_LIMITED');
    // đọc không bị giới hạn
    expect((await s.call('alice', 'GET', '/v1/me')).status).toBe(200);
    // hồi sau 2 giây
    s.advance(2_000);
    expect((await s.call('alice', 'POST', '/v1/enrollments', { joinCode: 'ZZZZZZZZ' })).status).toBe(404);
  });

  it('người dùng chéo trường xem progress → 403', async () => {
    const s = setup();
    const mk = async (uid: string) => ((await s.call(uid, 'POST', '/v1/me', { displayName: uid })).body as { id: string }).id;
    const aId = await mk('alice');
    await mk('mallory');
    s.store.users.get(aId)!.planId = 'pilot';
    const sch = (await s.call('alice', 'POST', '/v1/schools', { name: 'Trường', level: 'primary' })).body as { id: string };
    await s.call('alice', 'POST', `/v1/schools/${sch.id}/teachers`, { userId: aId });
    const cls = (await s.call('alice', 'POST', `/v1/schools/${sch.id}/classes`, { name: 'Lớp', capacity: 5 })).body as { id: string };
    const r = await s.call('mallory', 'GET', `/v1/classes/${cls.id}/progress`);
    expect(r.status).toBe(403);
    expect(errCode(r)).toBe('FORBIDDEN');
    expect((await s.call('mallory', 'GET', `/v1/schools/${sch.id}/audit`)).status).toBe(403);
    expect((await s.call('mallory', 'GET', '/v1/classes/nope/progress')).status).toBe(404);
  });

  it('GET /v1/me/progress chỉ trả StudentAck', async () => {
    const s = setup();
    const id = ((await s.call('carol', 'POST', '/v1/me', { displayName: 'Chị Cúc' })).body as { id: string }).id;
    const base = { sessionId: 'ss', classId: 'c', lessonId: 'l', userId: id, response: { kind: 'done' as const }, attempts: 1, at: 1 };
    s.store.results.set('k1', { ...base, activityId: 'a1', outcome: 'correct' });
    s.store.results.set('k2', { ...base, activityId: 'a2', outcome: 'incorrect' });
    s.store.results.set('k3', { ...base, activityId: 'a3', outcome: 'recorded' });
    const r = await s.call('carol', 'GET', '/v1/me/progress');
    expect(r.status).toBe(200);
    expect(r.body).toEqual([
      { activityId: 'a1', feedback: 'praise' },
      { activityId: 'a2', feedback: 'try_again' },
      { activityId: 'a3', feedback: 'thanks' },
    ]);
    for (const row of r.body as Array<Record<string, unknown>>) {
      expect(Object.keys(row).sort()).toEqual(['activityId', 'feedback']);
      expect(row).not.toHaveProperty('outcome');
      expect(row).not.toHaveProperty('response');
    }
  });

  it('phản hồi và log không chứa uid/tên hiển thị', async () => {
    const s = setup();
    const r = await s.call('secret-uid', 'POST', '/v1/me', { displayName: 'Tên Riêng' });
    expect(JSON.stringify(r.body)).not.toContain('secret-uid');
    expect(s.lines.join('\n')).not.toMatch(/secret-uid|Tên Riêng/);
    const req = s.lines.map((l) => JSON.parse(l)).find((l) => l.event === 'http.request');
    expect(req).toMatchObject({ method: 'POST', route: '/v1/me', status: 201 });
  });
});
