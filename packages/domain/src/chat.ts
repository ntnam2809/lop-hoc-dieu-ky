import { DomainError, forbidden, invalid } from './errors';
import type { ChatMode, ChatPayload, SchoolRole, Timestamp, User } from './types';

/** Danh mục câu/sticker duyệt sẵn — trẻ chỉ gửi được những thứ có trong đây. */
export interface ChatCatalog {
  phrases: ReadonlySet<string>;
  stickers: ReadonlySet<string>;
}

export const DEFAULT_CHAT_CATALOG: ChatCatalog = {
  phrases: new Set(['hello', 'thank-you', 'i-know', 'help-me', 'again', 'yay', 'good-job']),
  stickers: new Set(['star', 'heart', 'clap', 'wave', 'thinking']),
};

export const MAX_TEXT_LENGTH = 200;

/**
 * Chính sách chat thuần (CONSTITUTION §2, ADR-0007):
 * - Trẻ (`child`) **không bao giờ** gõ chữ tự do — chỉ câu/sticker duyệt sẵn, ở mọi chế độ.
 * - `off`: chỉ giáo viên gửi (thông báo). `phrases`: mọi người dùng câu/sticker; giáo viên gõ chữ được.
 * - `open`: người lớn gõ chữ tự do; trẻ vẫn chỉ câu/sticker.
 * Trả về payload đã chuẩn hoá hoặc ném DomainError.
 */
export function checkChat(
  sender: Pick<User, 'ageBand'>,
  role: SchoolRole,
  mode: ChatMode,
  payload: ChatPayload,
  catalog: ChatCatalog = DEFAULT_CHAT_CATALOG,
): ChatPayload {
  const isTeacher = role === 'teacher' || role === 'principal';
  if (mode === 'off' && !isTeacher) throw forbidden('Chat đang tắt trong phiên này');

  switch (payload.kind) {
    case 'phrase':
      if (!catalog.phrases.has(payload.phraseId)) throw invalid('Câu không có trong danh mục duyệt sẵn');
      return payload;
    case 'sticker':
      if (!catalog.stickers.has(payload.stickerId)) throw invalid('Sticker không có trong danh mục duyệt sẵn');
      return payload;
    case 'text': {
      if (sender.ageBand === 'child') throw forbidden('Tài khoản trẻ em chỉ gửi câu/sticker duyệt sẵn');
      if (!isTeacher && mode !== 'open') throw forbidden('Chế độ này chỉ cho câu/sticker duyệt sẵn');
      // Bỏ ký tự điều khiển, gộp khoảng trắng.
      const text = payload.text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text) throw invalid('Tin nhắn trống');
      if (text.length > MAX_TEXT_LENGTH) throw invalid(`Tin nhắn dài quá ${MAX_TEXT_LENGTH} ký tự`);
      return { kind: 'text', text };
    }
  }
}

/** Token bucket theo khoá (người gửi). Thuần, đồng hồ truyền vào để test tất định. */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: Timestamp }>();
  constructor(
    private readonly capacity: number,
    private readonly refillPerMs: number,
  ) {}

  take(key: string, now: Timestamp): void {
    const b = this.buckets.get(key) ?? { tokens: this.capacity, at: now };
    const tokens = Math.min(this.capacity, b.tokens + (now - b.at) * this.refillPerMs);
    if (tokens < 1) {
      this.buckets.set(key, { tokens, at: now });
      throw new DomainError('RATE_LIMITED', 'Gửi nhanh quá, chờ một chút nhé');
    }
    this.buckets.set(key, { tokens: tokens - 1, at: now });
  }
}

/** Mặc định: 5 tin liên tiếp, hồi 1 tin mỗi 3 giây. */
export const defaultChatLimiter = () => new RateLimiter(5, 1 / 3000);
