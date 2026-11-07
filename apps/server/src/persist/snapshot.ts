import type { DocDb, DocOp, Persistence, PersistRoot } from '../ports';

export class PersistError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PersistError';
  }
}

const DEFAULT_MAX_OPS = 450; // Firestore trần 500 ops/commit
const INDEX_RE = /^\d{10}$/;

const pad = (i: number): string => String(i).padStart(10, '0');

type Field = { name: string; collection: string; value: Map<string, unknown> | unknown[] };

/**
 * Lưu Store trong bộ nhớ xuống DocDb theo diff. SchoolService sửa tại chỗ nên không thể bắt sự kiện ghi;
 * thay vào đó so JSON hiện tại với bản đã lưu thành công (cache) ở mỗi flush.
 * Map: mỗi entry một doc (set/delete). Array: chỉ ghi thêm (create), dùng cho audit.
 */
export function createPersistence(
  db: DocDb,
  root: PersistRoot,
  opts: { prefix?: string; maxOpsPerCommit?: number } = {},
): Persistence {
  const prefix = opts.prefix ?? '';
  const maxOps = opts.maxOpsPerCommit ?? DEFAULT_MAX_OPS;
  if (!Number.isInteger(maxOps) || maxOps < 1) throw new PersistError('maxOpsPerCommit phải là số nguyên ≥ 1');

  /** Trạng thái đã lưu thành công: collection → id → json. */
  const cache = new Map<string, Map<string, string>>();
  let chain: Promise<unknown> = Promise.resolve();

  const fields = (): Field[] =>
    Object.keys(root)
      .sort()
      .map((name) => {
        const value: unknown = root[name];
        if (!(value instanceof Map) && !Array.isArray(value)) {
          throw new PersistError(`field "${name}" phải là Map hoặc Array`);
        }
        return { name, collection: `${prefix}${name}`, value: value as Map<string, unknown> | unknown[] };
      });

  const toJson = (name: string, v: unknown): string => {
    const json = JSON.stringify(v);
    if (typeof json !== 'string') throw new PersistError(`field "${name}": giá trị không tuần tự hoá được`);
    return json;
  };

  const savedOf = (collection: string): Map<string, string> => {
    let m = cache.get(collection);
    if (!m) {
      m = new Map();
      cache.set(collection, m);
    }
    return m;
  };

  function planOps(): DocOp[] {
    const ops: DocOp[] = [];
    for (const f of fields()) {
      const saved = cache.get(f.collection);
      if (f.value instanceof Map) {
        const seen = new Set<string>();
        for (const [key, val] of f.value) {
          const id = encodeURIComponent(String(key));
          seen.add(id);
          const json = toJson(f.name, val);
          if (saved?.get(id) !== json) ops.push({ kind: 'set', collection: f.collection, id, data: json });
        }
        if (saved) for (const id of saved.keys()) if (!seen.has(id)) ops.push({ kind: 'delete', collection: f.collection, id });
      } else {
        for (let i = saved?.size ?? 0; i < f.value.length; i++) {
          ops.push({ kind: 'create', collection: f.collection, id: pad(i), data: toJson(f.name, f.value[i]) });
        }
      }
    }
    return ops;
  }

  async function doFlush(): Promise<{ written: number }> {
    const ops = planOps();
    let written = 0;
    for (let i = 0; i < ops.length; i += maxOps) {
      const batch = ops.slice(i, i + maxOps);
      try {
        await db.commit(batch);
      } catch (e) {
        throw new PersistError(`ghi DocDb thất bại sau ${written} thao tác`, { cause: e });
      }
      for (const op of batch) {
        const m = savedOf(op.collection);
        if (op.kind === 'delete') m.delete(op.id);
        else m.set(op.id, op.data as string);
      }
      written += batch.length;
    }
    return { written };
  }

  async function doHydrate(): Promise<void> {
    const fs = fields();
    for (const f of fs) {
      const size = f.value instanceof Map ? f.value.size : f.value.length;
      if (size !== 0) throw new PersistError(`hydrate: field "${f.name}" không rỗng`);
    }
    const loaded: Array<{ f: Field; docs: Array<{ id: string; data: string }> }> = [];
    for (const f of fs) {
      let docs: Array<{ id: string; data: string }>;
      try {
        docs = await db.readAll(f.collection);
      } catch (e) {
        throw new PersistError(`hydrate: đọc "${f.collection}" thất bại`, { cause: e });
      }
      loaded.push({ f, docs });
    }
    // Parse hết vào bộ đệm tạm trước, chỉ đụng root/cache khi mọi field hợp lệ.
    const staged: Array<{ f: Field; items: Array<{ id: string; key: string; value: unknown }> }> = [];
    for (const { f, docs } of loaded) {
      const items: Array<{ id: string; key: string; value: unknown }> = [];
      const sorted = f.value instanceof Map ? docs : [...docs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      sorted.forEach((d, idx) => {
        if (!(f.value instanceof Map)) {
          if (!INDEX_RE.test(d.id) || Number(d.id) !== idx) {
            throw new PersistError(`hydrate: "${f.collection}" thiếu hoặc lệch chỉ số tại vị trí ${idx}`);
          }
        }
        let key = d.id;
        if (f.value instanceof Map) {
          try {
            key = decodeURIComponent(d.id);
          } catch (e) {
            throw new PersistError(`hydrate: id không giải mã được trong "${f.collection}"`, { cause: e });
          }
        }
        let value: unknown;
        try {
          value = JSON.parse(d.data);
        } catch (e) {
          throw new PersistError(`hydrate: JSON hỏng trong "${f.collection}"`, { cause: e });
        }
        items.push({ id: d.id, key, value });
      });
      staged.push({ f, items });
    }
    cache.clear();
    for (const { f, items } of staged) {
      const saved = savedOf(f.collection);
      const dataById = new Map(loaded.find((l) => l.f === f)?.docs.map((d) => [d.id, d.data]));
      for (const it of items) {
        if (f.value instanceof Map) f.value.set(it.key, it.value);
        else f.value.push(it.value);
        saved.set(it.id, dataById.get(it.id) as string);
      }
    }
  }

  return {
    hydrate() {
      const run = chain.then(doHydrate);
      chain = run.catch(() => undefined);
      return run;
    },
    flush() {
      const run = chain.then(doFlush);
      chain = run.catch(() => undefined);
      return run;
    },
  };
}
