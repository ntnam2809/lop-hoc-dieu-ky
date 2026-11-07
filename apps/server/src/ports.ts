import type { Id, SchoolService } from '@lhdk/domain';

export type DocOp = { kind: 'set' | 'create' | 'delete'; collection: string; id: string; data?: string };

/** Commit nguyên tử theo lô; 'create' trùng id → cả lô lỗi. */
export interface DocDb {
  readAll(collection: string): Promise<Array<{ id: string; data: string }>>;
  commit(ops: DocOp[]): Promise<void>;
}

export type PersistRoot = Record<string, Map<string, unknown> | unknown[]>;

export interface Persistence {
  hydrate(): Promise<void>;
  flush(): Promise<{ written: number }>;
}

export interface VerifiedIdentity {
  uid: string;
  provider: 'firebase' | 'dev';
}

export interface AuthVerifier {
  verify(token: string): Promise<VerifiedIdentity>;
}

/** Không nhận message ngoài để tránh lọt token vào lỗi/log. */
export class AuthError extends Error {
  readonly code = 'UNAUTHENTICATED' as const;
  constructor() {
    super('Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ');
    this.name = 'AuthError';
  }
}

export interface Identity {
  uid: string;
  userId: Id;
  linkedAt: number;
}

export type LogValue = string | number | boolean;
export type LogFields = Record<string, LogValue>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export type GuardVerdict = 'ok' | 'drop' | 'kick';

export interface MessageGuardPort {
  check(clientId: string): GuardVerdict;
  forget(clientId: string): void;
}

export interface RoomContext {
  service: SchoolService;
  /** Gọi sau lệnh làm đổi state nghiệp vụ; KHÔNG gọi cho move. */
  flush(): Promise<void>;
  /** Ném AuthError / DomainError; M2 chỉ trả người lớn. */
  authenticate(token: string | undefined): Promise<{ userId: Id }>;
  /** Mỗi room một guard. */
  newGuard(): MessageGuardPort;
  log: Logger;
  clock(): number;
}
