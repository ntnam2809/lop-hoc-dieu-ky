import type { PlanId } from './types';

/**
 * Quyền lợi theo gói. **Đây là số giả định kỹ thuật để chạy vertical slice, không phải giá/quota thương mại.**
 * Quota thật là quyết định của chủ dự án (docs/DECISIONS.md › Q-03). Gói `pilot` chỉ cấp tay cho người thử nghiệm,
 * không có thanh toán (ADR-0009).
 */
export interface PlanLimits {
  /** Số trường được làm chủ. Prompt gốc: account free chỉ làm học sinh hoặc giáo viên lớp nhỏ → free = 0. */
  maxOwnedSchools: number;
  /** Sĩ số tối đa một lớp do người này dạy. */
  maxClassSize: number;
  /** Số lớp tối đa người này dạy cùng lúc. */
  maxTaughtClasses: number;
  /** Sĩ số tối đa toàn trường cho trường người này làm chủ. */
  maxStudentsPerSchool: number;
  /** Tự tạo bài học (prompt gốc: chỉ account có phí). Chưa có trong MVP — cờ để giữ chỗ. */
  canAuthorLessons: boolean;
}

/**
 * Trần người trong một phiên live (kể cả giáo viên dẫn phiên). Quyết định của anh Nam 2026-11-06:
 * MVP chạy trên hạ tầng miễn phí, tối đa 20 người một phiên (ADR-0017).
 */
export const LIVE_SESSION_MAX_PARTICIPANTS = 20;

export const PLANS: Record<PlanId, PlanLimits> = {
  free: { maxOwnedSchools: 0, maxClassSize: 10, maxTaughtClasses: 1, maxStudentsPerSchool: 0, canAuthorLessons: false },
  pilot: { maxOwnedSchools: 1, maxClassSize: 20, maxTaughtClasses: 3, maxStudentsPerSchool: 100, canAuthorLessons: false },
};
