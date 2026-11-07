import { describe, expect, it } from 'vitest';
import {
  SchoolService,
  answerKeysFromPackage,
  createMemoryStore,
  lessonLookupFrom,
  sequentialIds,
  type GradablePackage,
  type Store,
} from '@lhdk/domain';
import type { DocDb, DocOp, PersistRoot } from '../src/ports';
import { createMemoryDocDb } from '../src/persist/memory-docdb';
import { PersistError, createPersistence } from '../src/persist/snapshot';

const PKG: GradablePackage = {
  lesson: { id: 'float-or-sink' },
  scenarios: [
    {
      activities: [
        {
          id: 'a9-quiz',
          type: 'object_identification',
          options: [{ id: 'duck' }, { id: 'rock' }],
          correctAnswer: 'duck',
        },
      ],
    },
  ],
};

const rootOf = (store: Store): PersistRoot => ({ ...store }) as PersistRoot;

const journey = (store: Store) => {
  let t = 1_000;
  const svc = new SchoolService({
    store,
    ids: sequentialIds(),
    clock: () => (t += 1000),
    lessons: lessonLookupFrom([answerKeysFromPackage(PKG)]),
  });
  const host = svc.registerUser({ displayName: 'Chủ trường chơi', planId: 'pilot' });
  const mom = svc.registerUser({ displayName: 'Mẹ Bi' });
  const school = svc.createSchool(host.id, { name: 'Trường thử', level: 'kindergarten' });
  svc.grantTeacher(host.id, school.id, host.id);
  const klass = svc.createClass(host.id, school.id, { name: 'Lớp thử', capacity: 20 });
  svc.enrollWithCode(mom.id, klass.joinCode);
  const plan = svc.createSessionPlan(host.id, school.id, {
    title: 'Kế hoạch',
    lessonId: 'float-or-sink',
    steps: [{ activityId: 'a9-quiz', note: 'Mở đầu', hintQuestions: ['Vịt nổi hay chìm?'] }],
  });
  const session = svc.startSession(host.id, klass.id, 'float-or-sink', { planId: plan.id });
  svc.joinSession(mom.id, session.id);
  svc.setActivity(host.id, session.id, 'a9-quiz');
  const result = svc.submitResult(mom.id, session.id, 'a9-quiz', { kind: 'choice', optionId: 'duck' });
  svc.sendChat(mom.id, session.id, { kind: 'text', text: 'Xin chào cả lớp' });
  return { svc, host, school, result };
};

const recording = (inner: DocDb) => {
  const ops: DocOp[][] = [];
  const db: DocDb = {
    readAll: (c) => inner.readAll(c),
    async commit(batch) {
      ops.push(batch.map((o) => ({ ...o })));
      await inner.commit(batch);
    },
  };
  return { db, ops };
};

describe('persist: round-trip với domain', () => {
  it('(a) flush rồi hydrate vào store mới giữ nguyên mọi Map, audit và sessionPlans', async () => {
    const db = createMemoryDocDb();
    const store = createMemoryStore();
    const { result } = journey(store);
    expect(result.outcome).toBe('correct');
    expect(result.response).toEqual({ kind: 'choice', optionId: 'duck' });
    expect(store.sessionPlans.size).toBe(1);

    const first = await createPersistence(db, rootOf(store)).flush();
    expect(first.written).toBeGreaterThan(0);

    const store2 = createMemoryStore();
    const p2 = createPersistence(db, rootOf(store2));
    await p2.hydrate();
    for (const k of ['users', 'schools', 'memberships', 'classes', 'enrollments', 'sessions', 'results', 'messages', 'reports', 'sessionPlans'] as const) {
      expect(store2[k], k).toEqual(store[k]);
    }
    expect(store2.sessionPlans.size).toBe(1);
    expect(store2.results.size).toBe(1);
    expect(store2.messages.size).toBe(1);
    expect(store2.audit).toEqual(store.audit);
    expect(store2.audit.length).toBeGreaterThan(0);
    // sau hydrate, cache = dữ liệu vừa đọc
    expect((await p2.flush()).written).toBe(0);
  });

  it('(b) flush lần 2 không đổi gì thì written 0', async () => {
    const db = createMemoryDocDb();
    const store = createMemoryStore();
    journey(store);
    const p = createPersistence(db, rootOf(store));
    await p.flush();
    const commits = db.commits;
    expect((await p.flush()).written).toBe(0);
    expect(db.commits).toBe(commits);
  });

  it('(c) sửa tại chỗ không qua set vẫn được ghi đúng 1 doc', async () => {
    const db = createMemoryDocDb();
    const store = createMemoryStore();
    const { school } = journey(store);
    const p = createPersistence(db, rootOf(store));
    await p.flush();
    (store.schools.get(school.id) as { name: string }).name = 'Tên mới';
    expect((await p.flush()).written).toBe(1);
    expect(JSON.parse(db.dump()['schools']?.[school.id] as string).name).toBe('Tên mới');
  });

  it('(d) audit dùng create, không bao giờ set', async () => {
    const { db, ops } = recording(createMemoryDocDb());
    const store = createMemoryStore();
    const { svc, host, school } = journey(store);
    const p = createPersistence(db, rootOf(store));
    await p.flush();
    svc.createClass(host.id, school.id, { name: 'Lớp hai', capacity: 10 });
    await p.flush();
    const audit = ops.flat().filter((o) => o.collection === 'audit');
    expect(audit.length).toBe(store.audit.length);
    expect(audit.every((o) => o.kind === 'create')).toBe(true);
  });
});

describe('persist: lỗi và lô', () => {
  it('(e) failNext(1): flush reject PersistError; lần sau ghi đủ, không create trùng', async () => {
    const db = createMemoryDocDb();
    const root: PersistRoot = { log: [{ n: 1 }, { n: 2 }], m: new Map([['a', 1]]) };
    const p = createPersistence(db, root);
    db.failNext(1);
    await expect(p.flush()).rejects.toBeInstanceOf(PersistError);
    expect(db.dump()).toEqual({});
    expect((await p.flush()).written).toBe(3);
    expect(db.dump()['log']).toEqual({ '0000000000': '{"n":1}', '0000000001': '{"n":2}' });
  });

  it('(f) maxOpsPerCommit=2 với 5 op thì 3 commit; lỗi ở lô 2 thì lô 1 không ghi lại', async () => {
    const mk = () => ({ log: [1, 2, 3, 4, 5] }) as PersistRoot;
    const ok = createMemoryDocDb();
    expect(await createPersistence(ok, mk(), { maxOpsPerCommit: 2 }).flush()).toEqual({ written: 5 });
    expect(ok.commits).toBe(3);

    const inner = createMemoryDocDb();
    const { db, ops } = recording(inner);
    let calls = 0;
    const flaky: DocDb = {
      readAll: db.readAll,
      commit: async (batch) => {
        calls += 1;
        if (calls === 2) {
          ops.push(batch.map((o) => ({ ...o })));
          throw new Error('boom');
        }
        return db.commit(batch);
      },
    };
    const p = createPersistence(flaky, mk(), { maxOpsPerCommit: 2 });
    await expect(p.flush()).rejects.toBeInstanceOf(PersistError);
    expect(Object.keys(inner.dump()['log'] ?? {})).toEqual(['0000000000', '0000000001']);
    expect(await p.flush()).toEqual({ written: 3 });
    const created = ops.flat().filter((o) => o.kind === 'create').map((o) => o.id);
    // lô 1 (0,1) chỉ một lần; lô 2 (2,3) thử hai lần (lỗi + ghi lại); lô 3 (4) một lần
    expect(created.filter((id) => id === '0000000000')).toHaveLength(1);
    expect(created.filter((id) => id === '0000000001')).toHaveLength(1);
    expect(Object.keys(inner.dump()['log'] ?? {})).toHaveLength(5);
  });

  it('flush gọi chồng nhau chạy lần lượt, lần sau thấy state mới nhất', async () => {
    const db = createMemoryDocDb();
    const m = new Map<string, unknown>([['a', 1]]);
    const p = createPersistence(db, { m });
    const f1 = p.flush();
    m.set('b', 2);
    const f2 = p.flush();
    expect((await f1).written + (await f2).written).toBe(2);
    expect(Object.keys(db.dump()['m'] ?? {})).toEqual(['a', 'b']);
  });
});

describe('persist: tổng quát hoá', () => {
  it('(g) field Map ngoài Store gốc vẫn được lưu/nạp; prefix áp vào collection', async () => {
    const db = createMemoryDocDb();
    const extra = new Map<string, unknown>([['i1', { uid: 'u1', userId: 'user-1', linkedAt: 5 }]]);
    await createPersistence(db, { extra }, { prefix: 'dev_' }).flush();
    expect(Object.keys(db.dump())).toEqual(['dev_extra']);
    const extra2 = new Map<string, unknown>();
    await createPersistence(db, { extra: extra2 }, { prefix: 'dev_' }).hydrate();
    expect(extra2).toEqual(extra);
  });

  it('(h) field kiểu số thì throw nêu tên field', async () => {
    const db = createMemoryDocDb();
    const root = { n: 3 } as unknown as PersistRoot;
    const p = createPersistence(db, root);
    await expect(p.flush()).rejects.toThrow(/"n"/);
    await expect(p.flush()).rejects.toBeInstanceOf(PersistError);
    await expect(p.hydrate()).rejects.toThrow(/"n"/);
  });

  it("(i) key chứa '/' và ':' round-trip đúng", async () => {
    const db = createMemoryDocDb();
    const m = new Map<string, unknown>([
      ['class-1:user/2', { a: 1 }],
      ['a%b c', { b: 2 }],
    ]);
    await createPersistence(db, { m }).flush();
    expect(Object.keys(db.dump()['m'] ?? {}).every((id) => !id.includes('/') && !id.includes(':'))).toBe(true);
    const m2 = new Map<string, unknown>();
    await createPersistence(db, { m: m2 }).hydrate();
    expect(m2).toEqual(m);
  });

  it('(j) hydrate vào root không rỗng thì throw; mảng thiếu chỉ số thì throw', async () => {
    const db = createMemoryDocDb();
    await expect(createPersistence(db, { m: new Map([['a', 1]]) }).hydrate()).rejects.toBeInstanceOf(PersistError);
    await expect(createPersistence(db, { log: [1] }).hydrate()).rejects.toBeInstanceOf(PersistError);

    await db.commit([
      { kind: 'create', collection: 'log', id: '0000000000', data: '1' },
      { kind: 'create', collection: 'log', id: '0000000002', data: '3' },
    ]);
    const log: unknown[] = [];
    const root = { log };
    await expect(createPersistence(db, root).hydrate()).rejects.toBeInstanceOf(PersistError);
    expect(log).toEqual([]);
  });
});

describe('memory docdb', () => {
  it('create trùng id thì cả lô không áp dụng', async () => {
    const db = createMemoryDocDb();
    await db.commit([{ kind: 'create', collection: 'c', id: 'x', data: '1' }]);
    await expect(
      db.commit([
        { kind: 'set', collection: 'c', id: 'y', data: '2' },
        { kind: 'create', collection: 'c', id: 'x', data: '3' },
      ]),
    ).rejects.toThrow();
    expect(db.dump()).toEqual({ c: { x: '1' } });
    expect(db.commits).toBe(1);
  });

  it('failNext làm commit kế tiếp throw đúng thông điệp', async () => {
    const db = createMemoryDocDb();
    db.failNext(2);
    const op: DocOp = { kind: 'set', collection: 'c', id: 'x', data: '1' };
    await expect(db.commit([op])).rejects.toThrow('memory docdb: injected failure');
    await expect(db.commit([op])).rejects.toThrow('memory docdb: injected failure');
    await db.commit([op]);
    expect(db.dump()).toEqual({ c: { x: '1' } });
  });
});
