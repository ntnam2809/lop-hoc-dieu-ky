import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { DocDb, DocOp } from '../ports.js';

const MAX_BATCH_OPS = 500;

/** Mỗi doc lưu `data` là chuỗi JSON (Firestore không nhận mảng lồng mảng). */
export function createFirestoreDocDb(fs: Firestore): DocDb {
  return {
    async readAll(collection) {
      const snap = await fs.collection(collection).get();
      return snap.docs.map((doc) => {
        const data: unknown = doc.get('data');
        if (typeof data !== 'string') throw new Error(`Doc ${collection}/${doc.id} thiếu trường data kiểu chuỗi`);
        return { id: doc.id, data };
      });
    },

    async commit(ops: DocOp[]) {
      if (ops.length > MAX_BATCH_OPS) throw new Error(`Lô ghi vượt ${MAX_BATCH_OPS} thao tác`);
      if (ops.length === 0) return;
      const batch = fs.batch();
      for (const op of ops) {
        const ref = fs.collection(op.collection).doc(op.id);
        if (op.kind === 'delete') {
          batch.delete(ref);
          continue;
        }
        if (op.data === undefined) throw new Error(`Thao tác ${op.kind} thiếu data`);
        const payload = { data: op.data, at: FieldValue.serverTimestamp() };
        if (op.kind === 'create') batch.create(ref, payload);
        else batch.set(ref, payload);
      }
      await batch.commit();
    },
  };
}
