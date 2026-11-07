import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config';

const prodOk = {
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: 'https://a.example',
  STORE: 'firestore',
  AUTH_MODE: 'firebase',
  FIREBASE_PROJECT_ID: 'proj',
};

const fail = (env: Record<string, string | undefined>): ConfigError => {
  try {
    loadConfig(env);
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return e as ConfigError;
  }
  throw new Error('expected ConfigError');
};

describe('loadConfig', () => {
  it('development phải đặt AUTH_MODE=dev rõ ràng; các mặc định khác giữ nguyên', () => {
    const c = loadConfig({ AUTH_MODE: 'dev' });
    expect(c).toMatchObject({
      port: 2567,
      nodeEnv: 'development',
      allowedOrigins: ['http://localhost:5180', 'http://localhost:5198'],
      allowMissingOrigin: true,
      store: 'memory',
      auth: 'dev',
      signupAllowlist: [],
      wsMaxPayloadBytes: 4096,
      httpMaxBodyBytes: 16384,
    });
    expect(c.firebaseProjectId).toBeUndefined();
  });

  it('thiếu NODE_ENV và AUTH_MODE → auth firebase, đòi FIREBASE_PROJECT_ID', () => {
    expect(fail({}).message).toContain('FIREBASE_PROJECT_ID');
    expect(loadConfig({ FIREBASE_PROJECT_ID: 'proj' }).auth).toBe('firebase');
    expect(fail({ NODE_ENV: 'development' }).message).toContain('FIREBASE_PROJECT_ID');
  });

  it('AUTH_MODE=dev + STORE=firestore: lỗi nếu không có emulator, OK nếu có FIRESTORE_EMULATOR_HOST', () => {
    const base = { NODE_ENV: 'development', AUTH_MODE: 'dev', STORE: 'firestore', FIREBASE_PROJECT_ID: 'proj' };
    const e = fail(base);
    expect(e.message).toContain('AUTH_MODE=dev chỉ dùng với STORE=memory hoặc Firestore emulator');
    const c = loadConfig({ ...base, FIRESTORE_EMULATOR_HOST: 'localhost:8080' });
    expect(c).toMatchObject({ auth: 'dev', store: 'firestore' });
  });

  it('mặc định test', () => {
    const c = loadConfig({ NODE_ENV: 'test' });
    expect(c.nodeEnv).toBe('test');
    expect(c.auth).toBe('dev');
    expect(c.store).toBe('memory');
  });

  it('production hợp lệ; AUTH_MODE mặc định firebase', () => {
    const { AUTH_MODE: _a, ...rest } = prodOk;
    const c = loadConfig({ ...rest, SIGNUP_ALLOWLIST: ' u1, ,u2 ' });
    expect(c.auth).toBe('firebase');
    expect(c.allowMissingOrigin).toBe(false);
    expect(c.signupAllowlist).toEqual(['u1', 'u2']);
    expect(c.firebaseProjectId).toBe('proj');
  });

  it('production thiếu ALLOWED_ORIGINS → lỗi', () => {
    expect(fail({ ...prodOk, ALLOWED_ORIGINS: '' }).message).toContain('ALLOWED_ORIGINS');
  });

  it('production + AUTH_MODE=dev → lỗi', () => {
    expect(fail({ ...prodOk, AUTH_MODE: 'dev' }).message).toContain('AUTH_MODE');
  });

  it('production + STORE=memory → lỗi', () => {
    expect(fail({ ...prodOk, STORE: 'memory' }).message).toContain('STORE');
  });

  it('firestore thiếu FIREBASE_PROJECT_ID → lỗi', () => {
    expect(fail({ STORE: 'firestore' }).message).toContain('FIREBASE_PROJECT_ID');
  });

  it('WS_MAX_PAYLOAD_BYTES ngoài phạm vi → lỗi', () => {
    expect(fail({ WS_MAX_PAYLOAD_BYTES: '100' }).message).toContain('WS_MAX_PAYLOAD_BYTES');
    expect(fail({ WS_MAX_PAYLOAD_BYTES: '70000' }).message).toContain('WS_MAX_PAYLOAD_BYTES');
    expect(fail({ HTTP_MAX_BODY_BYTES: 'abc' }).message).toContain('HTTP_MAX_BODY_BYTES');
  });

  it('PORT và NODE_ENV sai → lỗi', () => {
    expect(fail({ PORT: '70000' }).message).toContain('PORT');
    expect(fail({ NODE_ENV: 'staging' }).message).toContain('NODE_ENV');
  });

  it('gom mọi lỗi vào một ConfigError', () => {
    const e = fail({ NODE_ENV: 'production' });
    expect(e.problems.length).toBeGreaterThanOrEqual(3);
  });

  it('message lỗi không chứa giá trị biến', () => {
    const e = fail({
      NODE_ENV: 'SECRET123',
      PORT: 'SECRET123',
      STORE: 'SECRET123',
      AUTH_MODE: 'SECRET123',
      WS_MAX_PAYLOAD_BYTES: 'SECRET123',
      HTTP_MAX_BODY_BYTES: 'SECRET123',
    });
    expect(e.message).not.toContain('SECRET123');
    const e2 = fail({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'SECRET123', STORE: 'memory', AUTH_MODE: 'dev' });
    expect(e2.message).not.toContain('SECRET123');
  });
});
