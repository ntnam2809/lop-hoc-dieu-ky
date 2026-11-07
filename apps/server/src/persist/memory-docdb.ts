import type { DocDb, DocOp } from '../ports';

export type MemoryDocDb = DocDb & {
  /** Ảnh chụp toàn bộ: collection → id → data. */
  dump(): Record<string, Record<string, string>>;
  /** n lần commit kế tiếp (mặc định 1) sẽ ném lỗi và không áp dụng gì. */
  failNext(n?: number): void;
  /** Số commit đã thành công. */
  readonly commits: number;
};

/** DocDb trong bộ nhớ cho test/dev: commit nguyên tử theo lô, 'create' trùng id làm cả lô lỗi. */
export function createMemoryDocDb(): MemoryDocDb {
  const data = new Map<string, Map<string, string>>();
  let failures = 0;
  let commits = 0;

  const slot = (collection: string, id: string) => `${collection}\u0000${id}`;

  return {
    async readAll(collection) {
      const col = data.get(collection);
      return col ? [...col].map(([id, d]) => ({ id, data: d })) : [];
    },

    async commit(ops: DocOp[]) {
      if (failures > 0) {
        failures -= 1;
        throw new Error('memory docdb: injected failure');
      }
      // Kiểm hết trước trên lớp phủ (null = đã xoá trong lô), chưa đụng dữ liệu thật.
      const overlay = new Map<string, string | null>();
      const exists = (collection: string, id: string): boolean => {
        const s = slot(collection, id);
        if (overlay.has(s)) return overlay.get(s) !== null;
        return data.get(collection)?.has(id) ?? false;
      };
      for (const op of ops) {
        if (op.kind === 'delete') {
          overlay.set(slot(op.collection, op.id), null);
          continue;
        }
        if (typeof op.data !== 'string') throw new Error(`memory docdb: thiếu data cho ${op.kind} ${op.collection}/${op.id}`);
        if (op.kind === 'create' && exists(op.collection, op.id)) {
          throw new Error(`memory docdb: create trùng id ${op.collection}/${op.id}`);
        }
        overlay.set(slot(op.collection, op.id), op.data);
      }
      for (const op of ops) {
        let col = data.get(op.collection);
        if (op.kind === 'delete') {
          col?.delete(op.id);
          continue;
        }
        if (!col) {
          col = new Map();
          data.set(op.collection, col);
        }
        col.set(op.id, op.data as string);
      }
      commits += 1;
    },

    dump() {
      return Object.fromEntries([...data].map(([c, docs]) => [c, Object.fromEntries(docs)]));
    },

    failNext(n = 1) {
      failures += n;
    },

    get commits() {
      return commits;
    },
  };
}
