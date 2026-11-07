/**
 * Thực thể lõi của trường học online. Tách bạch theo ADR-0006:
 * danh tính (User) ≠ thành viên trường (Membership) ≠ ghi danh lớp (Enrollment) ≠ quyền lợi gói (Plan).
 * Không lưu email/điện thoại/vị trí của trẻ — chỉ tên hiển thị (CONSTITUTION §2).
 */

import type { NormalizedResponse } from './grading';

export type Id = string;
export type Timestamp = number; // ms epoch, do Clock cấp

/** Nhóm tuổi quyết định chính sách an toàn. Vai quản trị chỉ dành cho `adult`. */
export type AgeBand = 'child' | 'adult';

/** Id gói quyền lợi. Giá trị cụ thể là giả định kỹ thuật, chưa phải quyết định thương mại (DECISIONS: Q-03). */
export type PlanId = 'free' | 'pilot';

export interface User {
  id: Id;
  displayName: string;
  ageBand: AgeBand;
  planId: PlanId;
  /** Hồ sơ trẻ do giáo viên tạo cho lớp (không tự đăng ký): id trường quản lý hồ sơ. Trẻ không bao giờ là chủ tài khoản. */
  managedBySchoolId?: Id;
  /** Quản trị nền tảng (xác minh tổ chức). Chỉ gán bằng seed/CLI nội bộ, không bao giờ qua API công khai. */
  platformAdmin?: boolean;
  createdAt: Timestamp;
}

export type SchoolLevel = 'kindergarten' | 'primary' | 'secondary' | 'university';

/**
 * Hai không gian tách hẳn nhau (ADR-0014):
 * - `play`: trường chơi của người lớn (phụ huynh trải nghiệm RPG, hiểu cơ chế). **Không có hồ sơ trẻ.**
 * - `organization`: trường/tổ chức có thật bên ngoài, giáo viên thật quản lý. Trẻ chỉ tham gia ở đây,
 *   và chỉ sau khi quản trị nền tảng xác minh tổ chức. Người lớn ở đây chỉ mang vai quản trị/giáo viên.
 */
export type SchoolKind = 'play' | 'organization';
export type SchoolRole = 'principal' | 'teacher' | 'student';

export interface School {
  id: Id;
  name: string;
  level: SchoolLevel;
  kind: SchoolKind;
  /** Chỉ với `organization`: thời điểm quản trị nền tảng xác minh tổ chức có thật. */
  verifiedAt?: Timestamp;
  verifiedBy?: Id;
  ownerId: Id;
  /** Sĩ số tối đa toàn trường (học sinh). */
  studentCapacity: number;
  createdAt: Timestamp;
}

/** Vai luôn gắn phạm vi một trường; không có vai toàn hệ thống nào suy ra từ đây. */
export interface Membership {
  schoolId: Id;
  userId: Id;
  roles: SchoolRole[];
}

export interface SchoolClass {
  id: Id;
  schoolId: Id;
  name: string;
  teacherId: Id;
  capacity: number;
  /** Mã vào lớp do giáo viên chia sẻ trực tiếp — MVP không có danh bạ trường công khai. */
  joinCode: string;
  createdAt: Timestamp;
}

export interface Enrollment {
  classId: Id;
  userId: Id;
  enrolledAt: Timestamp;
}

/** Chế độ chat của phiên: `off` chỉ giáo viên thông báo · `phrases` câu/sticker duyệt sẵn · `open` người lớn gõ tự do. */
export type ChatMode = 'off' | 'phrases' | 'open';

export interface LessonSession {
  id: Id;
  classId: Id;
  schoolId: Id;
  lessonId: string;
  teacherId: Id;
  status: 'live' | 'ended';
  /** Hoạt động đang mở — do giáo viên điều khiển, server là nguồn sự thật. */
  currentActivityId: string | null;
  chatMode: ChatMode;
  participants: Id[];
  startedAt: Timestamp;
  endedAt?: Timestamp;
  /** Kế hoạch đã dùng để mở phiên (chỉ id) và danh sách hoạt động chụp lúc mở; không mang ghi chú/gợi ý của giáo viên. */
  planId?: Id;
  planActivityIds?: string[];
}

export type Outcome = 'correct' | 'incorrect' | 'recorded';

export interface ActivityResult {
  sessionId: Id;
  classId: Id;
  lessonId: string;
  userId: Id;
  activityId: string;
  /** Đáp án đã chuẩn hoá (chỉ trường đã biết, không chữ tự do). */
  response: NormalizedResponse;
  outcome: Outcome;
  attempts: number;
  at: Timestamp;
}

export type ChatPayload =
  | { kind: 'phrase'; phraseId: string }
  | { kind: 'sticker'; stickerId: string }
  | { kind: 'text'; text: string };

export interface ChatMessage {
  id: Id;
  sessionId: Id;
  senderId: Id;
  payload: ChatPayload;
  at: Timestamp;
  hidden: boolean;
}

export interface ModerationReport {
  id: Id;
  schoolId: Id;
  reporterId: Id;
  messageId: Id;
  reason: string;
  status: 'open' | 'resolved';
  at: Timestamp;
}

export type AuditAction =
  | 'school.create'
  | 'school.verify'
  | 'role.grant'
  | 'role.revoke'
  | 'class.create'
  | 'student.create'
  | 'enrollment.create'
  | 'session.start'
  | 'session.activity'
  | 'session.end'
  | 'chat.mode'
  | 'chat.hide'
  | 'report.create'
  | 'sessionPlan.create'
  | 'sessionPlan.update';

export interface AuditEvent {
  at: Timestamp;
  actorId: Id;
  action: AuditAction;
  schoolId: Id | null;
  target: Id;
  detail?: Record<string, unknown>;
}
