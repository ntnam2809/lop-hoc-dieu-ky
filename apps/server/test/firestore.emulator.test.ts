import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createFirestoreDocDb } from '../src/persist/firestore-docdb.js';

// Chỉ chạy khi có emulator (FIRESTORE_EMULATOR_HOST); CI bỏ qua.
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('firestore docdb (emulator)', () => {
  const app = initializeApp({ projectId: 'demo-lhdk-test' }, `emu-${Date.now()}`);
  const db = createFirestoreDocDb(getFirestore(app));
  const col = `t_${Date.now()}`;

  afterAll(async () => {
    await deleteApp(app);
  });

  it('set/create/delete/readAll round-trip', async () => {
    await db.commit([
      { kind: 'set', collection: col, id: 'a', data: '[[1,2]]' },
      { kind: 'create', collection: col, id: 'b', data: '{"x":1}' },
    ]);
    const rows = (await db.readAll(col)).sort((x, y) => x.id.localeCompare(y.id));
    expect(rows).toEqual([
      { id: 'a', data: '[[1,2]]' },
      { id: 'b', data: '{"x":1}' },
    ]);
    await db.commit([{ kind: 'delete', collection: col, id: 'a' }]);
    expect((await db.readAll(col)).map((r) => r.id)).toEqual(['b']);
  });

  it('create trùng id → commit reject', async () => {
    await expect(db.commit([{ kind: 'create', collection: col, id: 'b', data: '{}' }])).rejects.toThrow();
  });
});
