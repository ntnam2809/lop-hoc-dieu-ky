import type {
  ActivityResult,
  AuditEvent,
  ChatMessage,
  Enrollment,
  Id,
  LessonSession,
  Membership,
  ModerationReport,
  School,
  SchoolClass,
  User,
} from './types';
import type { SessionPlan } from './session-plan';

/**
 * Cổng lưu trữ. MVP dùng bộ nhớ; adapter Postgres (ADR-0004) hiện thực cùng giao diện.
 * Mọi kiểm tra quyền nằm ở SchoolService — Store không biết luật.
 */
export interface Store {
  users: Map<Id, User>;
  schools: Map<Id, School>;
  /** khoá `${schoolId}:${userId}` */
  memberships: Map<string, Membership>;
  classes: Map<Id, SchoolClass>;
  /** khoá `${classId}:${userId}` */
  enrollments: Map<string, Enrollment>;
  sessions: Map<Id, LessonSession>;
  /** khoá `${sessionId}:${userId}:${activityId}` */
  results: Map<string, ActivityResult>;
  messages: Map<Id, ChatMessage>;
  reports: Map<Id, ModerationReport>;
  sessionPlans: Map<Id, SessionPlan>;
  audit: AuditEvent[];
}

export const createMemoryStore = (): Store => ({
  users: new Map(),
  schools: new Map(),
  memberships: new Map(),
  classes: new Map(),
  enrollments: new Map(),
  sessions: new Map(),
  results: new Map(),
  messages: new Map(),
  reports: new Map(),
  sessionPlans: new Map(),
  audit: [],
});
