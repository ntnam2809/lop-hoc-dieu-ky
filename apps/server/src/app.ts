import { RateLimiter, SchoolService, createMemoryStore, type Id } from '@lhdk/domain';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createVerifier, type IdTokenChecker } from './auth/verifier.js';
import type { Config } from './config.js';
import { initFirebase } from './firebase.js';
import { ApiDenied, resolveActor } from './http/api.js';
import { createIds } from './ids.js';
import { loadLessons } from './lessons.js';
import { createLogger } from './log.js';
import { MessageGuard } from './net/guard.js';
import { createFirestoreDocDb } from './persist/firestore-docdb.js';
import { createMemoryDocDb } from './persist/memory-docdb.js';
import { createPersistence } from './persist/snapshot.js';
import type { AuthVerifier, DocDb, Identity, Logger, Persistence, RoomContext } from './ports.js';
import type { DevSeedCtx } from './rooms/campus-dev-seed.js';

/** Mọi thứ đã lắp xong của server: dùng chung cho HTTP, room và seed dev. */
export interface AppContext extends RoomContext {
  config: Config;
  store: ReturnType<typeof createMemoryStore>;
  identities: Map<string, Identity>;
  persistence: Persistence;
  verifier: AuthVerifier;
  /** Dùng chung cho /v1 và /campus/seat. */
  limiter: RateLimiter;
  lessonIds: string[];
  /** Ai được tự đăng ký hồ sơ mới qua POST /v1/me (dev: mọi người; firebase: uid trong SIGNUP_ALLOWLIST). */
  signupAllowed(uid: string): boolean;
  devUserId(label: string): Id | undefined;
  linkDevIdentity(label: string, userId: Id): void;
}

// AppContext phải gán được cho DevSeedCtx của world (kiểm lúc tsc).
const _seedCompat: DevSeedCtx = {} as AppContext;
void _seedCompat;

const DEV_LABEL = /^[a-z0-9-]{1,32}$/;

export async function createApp(
  config: Config,
  o: { docDb?: DocDb; idTokenChecker?: IdTokenChecker; clock?: () => number; log?: Logger; lessonsDir?: string } = {},
): Promise<AppContext> {
  const clock = o.clock ?? Date.now;
  const log = o.log ?? createLogger();

  const docDb: DocDb =
    o.docDb ?? (config.store === 'firestore' ? createFirestoreDocDb(getFirestore(initFirebase(config))) : createMemoryDocDb());
  const store = createMemoryStore();
  const identities = new Map<string, Identity>();
  const persistence = createPersistence(docDb, { ...store, identities });
  await persistence.hydrate();

  const { lookup, lessonIds } = loadLessons({ nodeEnv: config.nodeEnv, ...(o.lessonsDir !== undefined ? { dir: o.lessonsDir } : {}) });
  log.info('lessons.loaded', { n: lessonIds.length });
  // Không truyền grader: chấm bài thuộc về luồng lớp học, chưa nối ở bước này.
  const service = new SchoolService({ store, clock, ids: createIds(store), lessons: lookup });

  const verifier = createVerifier(
    config,
    config.auth === 'firebase' ? (o.idTokenChecker ?? getAuth(initFirebase(config))) : undefined,
  );
  const limiter = new RateLimiter(10, 1 / 2000);

  const flush = async (): Promise<void> => {
    const t0 = clock();
    const { written } = await persistence.flush();
    log.info('persist.flush', { written, ms: Math.max(0, clock() - t0) });
  };

  const devAllowed = config.auth === 'dev' && config.nodeEnv !== 'production';
  const allowlist = new Set(config.signupAllowlist);

  const ctx: AppContext = {
    config,
    store,
    identities,
    persistence,
    verifier,
    limiter,
    lessonIds,
    service,
    log,
    clock,
    flush,
    newGuard: () => new MessageGuard(),
    signupAllowed: (uid) => (config.auth === 'dev' ? true : allowlist.has(uid)),
    devUserId: (label) => identities.get(`dev:${label}`)?.userId,
    linkDevIdentity(label, userId) {
      if (!devAllowed) throw new Error('linkDevIdentity chỉ dùng khi AUTH_MODE=dev và không production');
      if (!DEV_LABEL.test(label)) throw new Error('Nhãn dev không hợp lệ');
      if (store.users.get(userId)?.ageBand !== 'adult') throw new Error('Danh tính dev chỉ gắn cho người lớn');
      identities.set(`dev:${label}`, { uid: `dev:${label}`, userId, linkedAt: clock() });
    },
    async authenticate(token) {
      const actor = await resolveActor({ verifier, identities, service }, token);
      if (actor.userId !== null) return { userId: actor.userId };
      if (actor.provider !== 'dev') throw new ApiDenied('NOT_REGISTERED', 'Chưa tạo hồ sơ');
      // Kiểm lại ngay trước khi tạo (đồng bộ) để hai yêu cầu đồng thời không tạo hai người.
      const existing = identities.get(actor.uid);
      if (existing) return { userId: existing.userId };
      const u = service.registerUser({ displayName: actor.uid.slice('dev:'.length) });
      identities.set(actor.uid, { uid: actor.uid, userId: u.id, linkedAt: clock() });
      await flush();
      return { userId: u.id };
    },
  };
  return ctx;
}

