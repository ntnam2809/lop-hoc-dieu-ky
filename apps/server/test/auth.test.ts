import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { createDevVerifier, createFirebaseVerifier, createVerifier, type IdTokenChecker } from '../src/auth/verifier.js';
import { createFirestoreDocDb } from '../src/persist/firestore-docdb.js';
import { AuthError, type DocOp } from '../src/ports.js';

describe('firebase verifier', () => {
  it('token hợp lệ → uid, provider firebase, checkRevoked=true', async () => {
    const verifyIdToken = vi.fn(async () => ({ uid: 'u1' }));
    const v = createFirebaseVerifier({ verifyIdToken });
    await expect(v.verify('tok')).resolves.toEqual({ uid: 'u1', provider: 'firebase' });
    expect(verifyIdToken).toHaveBeenCalledWith('tok', true);
  });

  it('checker ném → AuthError, không lọt message gốc', async () => {
    const checker: IdTokenChecker = {
      verifyIdToken: async () => {
        throw new Error('boom-SECRET');
      },
    };
    const err = await createFirebaseVerifier(checker)
      .verify('tok')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as Error).message).not.toContain('boom-SECRET');
  });

  it('token rỗng hoặc > 4096 → AuthError, không gọi checker', async () => {
    const verifyIdToken = vi.fn(async () => ({ uid: 'u1' }));
    const v = createFirebaseVerifier({ verifyIdToken });
    await expect(v.verify('')).rejects.toBeInstanceOf(AuthError);
    await expect(v.verify('a'.repeat(4097))).rejects.toBeInstanceOf(AuthError);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});

describe('dev verifier', () => {
  it('nhận dev:alice', async () => {
    await expect(createDevVerifier().verify('dev:alice')).resolves.toEqual({ uid: 'dev:alice', provider: 'dev' });
  });
  it.each(['alice', 'dev:A B', 'dev:', 'dev:' + 'a'.repeat(33), 'dev:Alice'])('từ chối %j', async (t) => {
    await expect(createDevVerifier().verify(t)).rejects.toBeInstanceOf(AuthError);
  });
});

describe('createVerifier', () => {
  it('dev + production → throw', () => {
    expect(() => createVerifier({ auth: 'dev', nodeEnv: 'production' })).toThrow();
  });
  it('dev + development → ok', () => {
    expect(() => createVerifier({ auth: 'dev', nodeEnv: 'development' })).not.toThrow();
  });
  it('firebase thiếu checker → throw', () => {
    expect(() => createVerifier({ auth: 'firebase', nodeEnv: 'production' })).toThrow();
  });
  it('firebase có checker → ok', () => {
    const checker: IdTokenChecker = { verifyIdToken: async () => ({ uid: 'x' }) };
    expect(() => createVerifier({ auth: 'firebase', nodeEnv: 'production' }, checker)).not.toThrow();
  });
});

describe('firestore docdb (Firestore giả)', () => {
  function fake(docs: Array<{ id: string; data: unknown }> = []) {
    const calls: Array<{ op: string; path: string; payload?: Record<string, unknown> }> = [];
    const commit = vi.fn(async () => undefined);
    const fs = {
      collection: (c: string) => ({
        doc: (id: string) => ({ path: `${c}/${id}` }),
        get: async () => ({ docs: docs.map((d) => ({ id: d.id, get: (f: string) => (f === 'data' ? d.data : undefined) })) }),
      }),
      batch: () => ({
        set: (r: { path: string }, p: Record<string, unknown>) => calls.push({ op: 'set', path: r.path, payload: p }),
        create: (r: { path: string }, p: Record<string, unknown>) => calls.push({ op: 'create', path: r.path, payload: p }),
        delete: (r: { path: string }) => calls.push({ op: 'delete', path: r.path }),
        commit,
      }),
    } as unknown as Firestore;
    return { fs, calls, commit };
  }

  it('commit ghi đúng op trong một batch', async () => {
    const { fs, calls, commit } = fake();
    await createFirestoreDocDb(fs).commit([
      { kind: 'set', collection: 'a', id: '1', data: '[[1]]' },
      { kind: 'create', collection: 'a', id: '2', data: '{}' },
      { kind: 'delete', collection: 'a', id: '3' },
    ]);
    expect(calls.map((c) => `${c.op}:${c.path}`)).toEqual(['set:a/1', 'create:a/2', 'delete:a/3']);
    expect(calls[0]?.payload?.data).toBe('[[1]]');
    expect(calls[0]?.payload).toHaveProperty('at');
    expect(calls[2]?.payload).toBeUndefined();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('> 500 op → throw trước khi gửi', async () => {
    const { fs, calls, commit } = fake();
    const ops: DocOp[] = Array.from({ length: 501 }, (_, i) => ({ kind: 'set', collection: 'a', id: String(i), data: '{}' }));
    await expect(createFirestoreDocDb(fs).commit(ops)).rejects.toThrow();
    expect(calls).toHaveLength(0);
    expect(commit).not.toHaveBeenCalled();
  });

  it('readAll trả id + data; thiếu data chuỗi → throw', async () => {
    await expect(createFirestoreDocDb(fake([{ id: 'x', data: '{"a":1}' }]).fs).readAll('c')).resolves.toEqual([
      { id: 'x', data: '{"a":1}' },
    ]);
    await expect(createFirestoreDocDb(fake([{ id: 'y', data: 5 }]).fs).readAll('c')).rejects.toThrow();
  });
});
