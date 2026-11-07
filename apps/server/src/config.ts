export interface Config {
  port: number;
  nodeEnv: 'development' | 'test' | 'production';
  allowedOrigins: string[];
  allowMissingOrigin: boolean;
  store: 'memory' | 'firestore';
  auth: 'dev' | 'firebase';
  firebaseProjectId?: string;
  signupAllowlist: string[];
  wsMaxPayloadBytes: number;
  httpMaxBodyBytes: number;
}

/** Message chỉ liệt kê TÊN biến lỗi, không bao giờ in giá trị (tránh lọt secret). */
export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Cấu hình môi trường không hợp lệ: ${problems.join('; ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

const NODE_ENVS = ['development', 'test', 'production'] as const;
const DEV_ORIGINS = ['http://localhost:5180', 'http://localhost:5198'];

const list = (v: string | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');

export function loadConfig(env: Record<string, string | undefined>): Config {
  const problems: string[] = [];
  const get = (k: string): string | undefined => {
    const v = env[k]?.trim();
    return v === undefined || v === '' ? undefined : v;
  };
  const int = (k: string, def: number, min: number, max: number): number => {
    const raw = get(k);
    if (raw === undefined) return def;
    const n = /^-?\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(n) || n < min || n > max) {
      problems.push(`${k} phải là số nguyên trong khoảng ${min}..${max}`);
      return def;
    }
    return n;
  };

  const port = int('PORT', 2567, 0, 65535);

  let nodeEnv: Config['nodeEnv'] = 'development';
  const rawEnv = get('NODE_ENV');
  if (rawEnv !== undefined) {
    if ((NODE_ENVS as readonly string[]).includes(rawEnv)) nodeEnv = rawEnv as Config['nodeEnv'];
    else problems.push('NODE_ENV phải là development | test | production');
  }
  const prod = nodeEnv === 'production';

  let allowedOrigins = list(env.ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    if (prod) problems.push('ALLOWED_ORIGINS bắt buộc khi production');
    else allowedOrigins = [...DEV_ORIGINS];
  }

  let store: Config['store'] = 'memory';
  const rawStore = get('STORE');
  if (rawStore !== undefined) {
    if (rawStore === 'memory' || rawStore === 'firestore') store = rawStore;
    else problems.push('STORE phải là memory | firestore');
  }
  if (prod && store === 'memory') problems.push('STORE không được là memory khi production');

  // Đóng mặc định: chỉ NODE_ENV=test mới tự dùng dev; thiếu NODE_ENV thì vẫn là firebase.
  let auth: Config['auth'] = nodeEnv === 'test' ? 'dev' : 'firebase';
  const rawAuth = get('AUTH_MODE');
  if (rawAuth !== undefined) {
    if (rawAuth === 'dev' || rawAuth === 'firebase') auth = rawAuth;
    else problems.push('AUTH_MODE phải là dev | firebase');
  }
  if (prod && auth === 'dev') problems.push('AUTH_MODE không được là dev khi production');
  // Danh tính dev và seedDevCampus không bao giờ được ghi vào Firestore thật.
  if (auth === 'dev' && store === 'firestore' && get('FIRESTORE_EMULATOR_HOST') === undefined) {
    problems.push('AUTH_MODE=dev chỉ dùng với STORE=memory hoặc Firestore emulator');
  }

  const firebaseProjectId = get('FIREBASE_PROJECT_ID');
  if ((store === 'firestore' || auth === 'firebase') && firebaseProjectId === undefined) {
    problems.push('FIREBASE_PROJECT_ID bắt buộc khi STORE=firestore hoặc AUTH_MODE=firebase');
  }

  const wsMaxPayloadBytes = int('WS_MAX_PAYLOAD_BYTES', 4096, 512, 65536);
  const httpMaxBodyBytes = int('HTTP_MAX_BODY_BYTES', 16384, 1024, 262144);

  if (problems.length > 0) throw new ConfigError(problems);

  const cfg: Config = {
    port,
    nodeEnv,
    allowedOrigins,
    allowMissingOrigin: nodeEnv !== 'production',
    store,
    auth,
    signupAllowlist: list(env.SIGNUP_ALLOWLIST),
    wsMaxPayloadBytes,
    httpMaxBodyBytes,
  };
  if (firebaseProjectId !== undefined) cfg.firebaseProjectId = firebaseProjectId;
  return cfg;
}
