export type ErrorCode = 'FORBIDDEN' | 'NOT_FOUND' | 'QUOTA' | 'INVALID' | 'CONFLICT' | 'RATE_LIMITED';

/** Lỗi nghiệp vụ có mã ổn định để transport (HTTP/WebSocket) dịch thành phản hồi. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const forbidden = (msg: string) => new DomainError('FORBIDDEN', msg);
export const notFound = (what: string) => new DomainError('NOT_FOUND', `Không tìm thấy ${what}`);
export const invalid = (msg: string) => new DomainError('INVALID', msg);
export const quota = (msg: string) => new DomainError('QUOTA', msg);
export const conflict = (msg: string) => new DomainError('CONFLICT', msg);
