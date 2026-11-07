import type { Config } from '../config.js';
import { AuthError, type AuthVerifier } from '../ports.js';

const MAX_TOKEN_LEN = 4096;
const DEV_TOKEN = /^dev:[a-z0-9-]{1,32}$/;

/** getAuth(app) thoả interface này. */
export interface IdTokenChecker {
  verifyIdToken(token: string, checkRevoked: boolean): Promise<{ uid: string }>;
}

export function createFirebaseVerifier(checker: IdTokenChecker): AuthVerifier {
  return {
    async verify(token) {
      if (typeof token !== 'string' || token === '' || token.length > MAX_TOKEN_LEN) throw new AuthError();
      let uid: string;
      try {
        ({ uid } = await checker.verifyIdToken(token, true));
      } catch {
        throw new AuthError();
      }
      if (typeof uid !== 'string' || uid === '') throw new AuthError();
      return { uid, provider: 'firebase' };
    },
  };
}

export function createDevVerifier(): AuthVerifier {
  return {
    async verify(token) {
      if (typeof token !== 'string' || !DEV_TOKEN.test(token)) throw new AuthError();
      return { uid: token, provider: 'dev' };
    },
  };
}

export function createVerifier(cfg: Pick<Config, 'auth' | 'nodeEnv'>, checker?: IdTokenChecker): AuthVerifier {
  if (cfg.auth === 'dev') {
    if (cfg.nodeEnv === 'production') throw new Error('Xác thực dev bị cấm khi production');
    return createDevVerifier();
  }
  if (checker === undefined) throw new Error('AUTH_MODE=firebase cần IdTokenChecker');
  return createFirebaseVerifier(checker);
}
