import { DomainError, toStudentAck, type ErrorCode, type Id, type RateLimiter, type SchoolService } from '@lhdk/domain';
import { z, type ZodType } from 'zod';
import { AuthError, type AuthVerifier, type Identity, type Logger } from '../ports.js';

export interface ApiRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

export interface ApiDeps {
  service: SchoolService;
  verifier: AuthVerifier;
  flush: () => Promise<void>;
  identities: Map<string, Identity>;
  signupAllowed: (uid: string) => boolean;
  clock: () => number;
  log: Logger;
  /** Dùng chung với /campus/seat; do app.ts tạo và tiêm vào. */
  limiter: RateLimiter;
}

/** Từ chối 403 có mã riêng của tầng HTTP (NOT_REGISTERED, ADULT_ONLY, SIGNUP_CLOSED). */
export class ApiDenied extends DomainError {
  constructor(
    readonly reason: 'NOT_REGISTERED' | 'ADULT_ONLY' | 'SIGNUP_CLOSED',
    message: string,
  ) {
    super('FORBIDDEN', message);
    this.name = 'ApiDenied';
  }
}

const STATUS: Record<ErrorCode, number> = {
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID: 400,
  QUOTA: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
};

const errorBody = (code: string, message: string) => ({ error: { code, message } });

export function toErrorResponse(e: unknown, log: Logger): ApiResponse {
  if (e instanceof AuthError) return { status: 401, body: errorBody('UNAUTHENTICATED', e.message) };
  if (e instanceof DomainError) {
    const code = e instanceof ApiDenied ? e.reason : e.code;
    return { status: STATUS[e.code], body: errorBody(code, e.message) };
  }
  const name = e instanceof Error && /^[A-Za-z0-9_]{1,64}$/.test(e.name) ? e.name : 'Error';
  log.error('http.error', { code: name });
  return { status: 500, body: errorBody('INTERNAL', 'Lỗi hệ thống, vui lòng thử lại sau') };
}

export function parseJsonBody<T>(schema: ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  // Không đưa thông điệp zod ra ngoài: có thể lặp lại giá trị người dùng gửi.
  if (!r.success) throw new DomainError('INVALID', 'Dữ liệu gửi lên không hợp lệ');
  return r.data;
}

export function readBearer(headers: Record<string, string | undefined>): string | undefined {
  let raw: string | undefined;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === 'authorization') {
      raw = v;
      break;
    }
  }
  if (typeof raw !== 'string') return undefined;
  const m = /^Bearer +(\S+)$/i.exec(raw.trim());
  return m ? m[1] : undefined;
}

export async function resolveActor(
  d: Pick<ApiDeps, 'verifier' | 'identities' | 'service'>,
  token: string | undefined,
): Promise<{ uid: string; provider: 'firebase' | 'dev'; userId: Id | null }> {
  if (!token) throw new AuthError();
  let verified;
  try {
    verified = await d.verifier.verify(token);
  } catch {
    throw new AuthError(); // mọi lỗi xác thực → 401 trơn, không lộ chi tiết
  }
  const link = d.identities.get(verified.uid);
  if (!link) return { uid: verified.uid, provider: verified.provider, userId: null };
  const user = d.service.store.users.get(link.userId);
  if (!user || user.ageBand !== 'adult') throw new ApiDenied('ADULT_ONLY', 'Chỉ dành cho tài khoản người lớn');
  return { uid: verified.uid, provider: verified.provider, userId: link.userId };
}

// ───────────── body schema (strict: key lạ → 400) ─────────────

const MeBody = z.object({ displayName: z.string().max(60) }).strict();
const SchoolBody = z
  .object({ name: z.string().max(60), level: z.enum(['kindergarten', 'primary', 'secondary', 'university']) })
  .strict();
const TeacherBody = z.object({ userId: z.string().min(1).max(64) }).strict();
const ClassBody = z.object({ name: z.string().max(60), capacity: z.number().int() }).strict();
const EnrollBody = z.object({ joinCode: z.string().min(1).max(16) }).strict();

// ───────────── bảng route ─────────────

interface Ctx {
  d: ApiDeps;
  uid: string;
  userId: Id | null;
  params: Record<string, string>;
  body: unknown;
}

interface Route {
  method: 'GET' | 'POST' | 'DELETE';
  template: string;
  /** Lệnh làm đổi dữ liệu: giới hạn tần suất + flush sau khi thành công. */
  write: boolean;
  /** Chỉ POST /v1/me được phép khi chưa liên kết hồ sơ. */
  allowUnlinked?: boolean;
  run(c: Ctx & { userId: Id | null }): ApiResponse;
}

const need = (c: Ctx): Id => {
  if (c.userId === null) throw new ApiDenied('NOT_REGISTERED', 'Chưa tạo hồ sơ');
  return c.userId;
};

const ROUTES: Route[] = [
  {
    method: 'GET',
    template: '/v1/me',
    write: false,
    run: (c) => {
      const u = c.d.service.user(need(c));
      return { status: 200, body: { id: u.id, displayName: u.displayName, planId: u.planId } };
    },
  },
  {
    method: 'POST',
    template: '/v1/me',
    write: true,
    allowUnlinked: true,
    run: (c) => {
      const input = parseJsonBody(MeBody, c.body);
      if (c.userId !== null) throw new DomainError('CONFLICT', 'Tài khoản đã có hồ sơ');
      if (!c.d.signupAllowed(c.uid)) throw new ApiDenied('SIGNUP_CLOSED', 'Hiện chưa mở đăng ký cho tài khoản này');
      // Chỉ displayName: ageBand/planId/platformAdmin không bao giờ đi qua API.
      const u = c.d.service.registerUser({ displayName: input.displayName });
      c.d.identities.set(c.uid, { uid: c.uid, userId: u.id, linkedAt: c.d.clock() });
      return { status: 201, body: { id: u.id, displayName: u.displayName, planId: u.planId } };
    },
  },
  {
    method: 'POST',
    template: '/v1/schools',
    write: true,
    run: (c) => {
      const input = parseJsonBody(SchoolBody, c.body);
      // MVP-A: chỉ trường chơi của người lớn.
      const s = c.d.service.createSchool(need(c), { name: input.name, level: input.level, kind: 'play' });
      return { status: 201, body: { id: s.id, name: s.name, level: s.level, kind: s.kind, studentCapacity: s.studentCapacity } };
    },
  },
  {
    method: 'POST',
    template: '/v1/schools/:schoolId/teachers',
    write: true,
    run: (c) => {
      const input = parseJsonBody(TeacherBody, c.body);
      c.d.service.grantTeacher(need(c), c.params.schoolId!, input.userId);
      return { status: 204 };
    },
  },
  {
    method: 'DELETE',
    template: '/v1/schools/:schoolId/teachers/:userId',
    write: true,
    run: (c) => {
      c.d.service.revokeTeacher(need(c), c.params.schoolId!, c.params.userId!);
      return { status: 204 };
    },
  },
  {
    method: 'POST',
    template: '/v1/schools/:schoolId/classes',
    write: true,
    run: (c) => {
      const input = parseJsonBody(ClassBody, c.body);
      const k = c.d.service.createClass(need(c), c.params.schoolId!, input);
      return { status: 201, body: { id: k.id, schoolId: k.schoolId, name: k.name, capacity: k.capacity, joinCode: k.joinCode } };
    },
  },
  {
    method: 'POST',
    template: '/v1/enrollments',
    write: true,
    run: (c) => {
      const input = parseJsonBody(EnrollBody, c.body);
      const k = c.d.service.enrollWithCode(need(c), input.joinCode);
      return { status: 201, body: { classId: k.id } };
    },
  },
  {
    method: 'GET',
    template: '/v1/classes/:classId/progress',
    write: false,
    run: (c) => ({ status: 200, body: c.d.service.classProgress(need(c), c.params.classId!) }),
  },
  {
    method: 'GET',
    template: '/v1/schools/:schoolId/reports',
    write: false,
    run: (c) => ({ status: 200, body: c.d.service.schoolReports(need(c), c.params.schoolId!) }),
  },
  {
    method: 'GET',
    template: '/v1/schools/:schoolId/audit',
    write: false,
    run: (c) => ({ status: 200, body: c.d.service.schoolAudit(need(c), c.params.schoolId!) }),
  },
  {
    method: 'GET',
    template: '/v1/me/progress',
    write: false,
    // Chỉ StudentAck: không outcome/response thô.
    run: (c) => ({ status: 200, body: c.d.service.myProgress(need(c)).map(toStudentAck) }),
  },
];

const PARAM_RE = /^[A-Za-z0-9_-]{1,64}$/;

function match(method: string, path: string): { route: Route; params: Record<string, string> } | null {
  const clean = path.split('?')[0]!;
  const segs = clean.split('/');
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const pat = route.template.split('/');
    if (pat.length !== segs.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < pat.length && ok; i++) {
      const p = pat[i]!;
      const s = segs[i]!;
      if (p.startsWith(':')) {
        if (PARAM_RE.test(s)) params[p.slice(1)] = s;
        else ok = false;
      } else if (p !== s) ok = false;
    }
    if (ok) return { route, params };
  }
  return null;
}

export function createApi(d: ApiDeps): (req: ApiRequest) => Promise<ApiResponse> {
  return async (req) => {
    const t0 = d.clock();
    const m = match(req.method, req.path);
    let userId: Id | null = null;
    let res: ApiResponse;
    try {
      if (!m) {
        res = { status: 404, body: errorBody('NOT_FOUND', 'Không tìm thấy đường dẫn') };
      } else {
        const actor = await resolveActor(d, readBearer(req.headers));
        userId = actor.userId;
        if (userId === null && !m.route.allowUnlinked) throw new ApiDenied('NOT_REGISTERED', 'Chưa tạo hồ sơ');
        if (m.route.write) d.limiter.take(userId ?? actor.uid, d.clock());
        res = m.route.run({ d, uid: actor.uid, userId, params: m.params, body: req.body });
        if (m.route.write) {
          try {
            await d.flush();
          } catch {
            d.log.error('persist.fail', userId ? { userId } : {});
            res = { status: 503, body: errorBody('UNAVAILABLE', 'Hệ thống tạm thời chưa lưu được, thử lại sau') };
          }
        }
      }
    } catch (e) {
      res = toErrorResponse(e, d.log);
    }
    d.log.info('http.request', {
      method: req.method,
      route: m ? m.route.template : 'unmatched',
      status: res.status,
      ms: Math.max(0, d.clock() - t0),
      ...(userId ? { userId } : {}),
    });
    return res;
  };
}
