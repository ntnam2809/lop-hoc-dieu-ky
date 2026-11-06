import { defaultChatLimiter, checkChat, type ChatCatalog, DEFAULT_CHAT_CATALOG, type RateLimiter } from './chat';
import { conflict, forbidden, invalid, notFound, quota } from './errors';
import { PLANS, type PlanLimits } from './plans';
import { createMemoryStore, type Store } from './store';
import type {
  ActivityResult,
  AgeBand,
  AuditAction,
  ChatMessage,
  ChatMode,
  ChatPayload,
  Id,
  LessonSession,
  ModerationReport,
  Outcome,
  PlanId,
  School,
  SchoolClass,
  SchoolKind,
  SchoolLevel,
  SchoolRole,
  Timestamp,
  User,
} from './types';

/** Chấm một câu trả lời. Module learning cấp bản thật (đọc đáp án trong gói bài); mặc định chỉ ghi nhận. */
export type Grader = (lessonId: string, activityId: string, response: unknown) => Outcome;

export interface ServiceDeps {
  store?: Store;
  clock?: () => Timestamp;
  /** Sinh id/mã. Server PHẢI cấp bản ngẫu nhiên an toàn cho `code` (mã vào lớp không được đoán được). */
  ids?: (kind: 'user' | 'school' | 'class' | 'session' | 'message' | 'report' | 'code') => string;
  grader?: Grader;
  chatCatalog?: ChatCatalog;
  chatLimiter?: RateLimiter;
}

export const sequentialIds = () => {
  const n: Record<string, number> = {};
  return (kind: string) => `${kind}-${(n[kind] = (n[kind] ?? 0) + 1)}`;
};

const NAME_MAX = 60;
const cleanName = (s: string, what: string) => {
  const v = s.replace(/\s+/g, ' ').trim();
  if (!v || v.length > NAME_MAX) throw invalid(`${what} phải có 1–${NAME_MAX} ký tự`);
  return v;
};

/**
 * Dịch vụ nghiệp vụ duy nhất của vertical slice. Mọi lệnh nhận `actorId` đã xác thực từ transport
 * và tự kiểm quyền theo phạm vi trường/lớp (CONSTITUTION §3: server là nguồn sự thật).
 */
export class SchoolService {
  readonly store: Store;
  private readonly now: () => Timestamp;
  private readonly id: NonNullable<ServiceDeps['ids']>;
  private readonly grade: Grader;
  private readonly catalog: ChatCatalog;
  private readonly limiter: RateLimiter;

  constructor(deps: ServiceDeps = {}) {
    this.store = deps.store ?? createMemoryStore();
    this.now = deps.clock ?? (() => Date.now());
    this.id = deps.ids ?? sequentialIds();
    this.grade = deps.grader ?? (() => 'recorded');
    this.catalog = deps.chatCatalog ?? DEFAULT_CHAT_CATALOG;
    this.limiter = deps.chatLimiter ?? defaultChatLimiter();
  }

  // ───────────── tra cứu & luật quyền ─────────────

  user(id: Id): User {
    const u = this.store.users.get(id);
    if (!u) throw notFound('người dùng');
    return u;
  }
  school(id: Id): School {
    const s = this.store.schools.get(id);
    if (!s) throw notFound('trường');
    return s;
  }
  klass(id: Id): SchoolClass {
    const c = this.store.classes.get(id);
    if (!c) throw notFound('lớp');
    return c;
  }
  session(id: Id): LessonSession {
    const s = this.store.sessions.get(id);
    if (!s) throw notFound('phiên học');
    return s;
  }

  rolesIn(schoolId: Id, userId: Id): SchoolRole[] {
    return this.store.memberships.get(`${schoolId}:${userId}`)?.roles ?? [];
  }
  hasRole(schoolId: Id, userId: Id, role: SchoolRole): boolean {
    return this.rolesIn(schoolId, userId).includes(role);
  }
  isEnrolled(classId: Id, userId: Id): boolean {
    return this.store.enrollments.has(`${classId}:${userId}`);
  }
  /** Quản lý lớp = giáo viên phụ trách (còn vai teacher) hoặc hiệu trưởng của chính trường đó. */
  canManageClass(userId: Id, c: SchoolClass): boolean {
    return (c.teacherId === userId && this.hasRole(c.schoolId, userId, 'teacher')) || this.hasRole(c.schoolId, userId, 'principal');
  }

  private limitsFor(user: User): PlanLimits {
    return PLANS[user.planId];
  }
  /** Giả định A-07: trường chi trả sức chứa cho giáo viên của trường → lấy mức cao hơn giữa gói giáo viên và gói chủ trường. */
  private teachingLimits(teacher: User, school: School) {
    const t = this.limitsFor(teacher);
    const o = this.limitsFor(this.user(school.ownerId));
    return { maxClassSize: Math.max(t.maxClassSize, o.maxClassSize), maxTaughtClasses: Math.max(t.maxTaughtClasses, o.maxTaughtClasses) };
  }

  private addRole(schoolId: Id, userId: Id, role: SchoolRole) {
    const key = `${schoolId}:${userId}`;
    const m = this.store.memberships.get(key) ?? { schoolId, userId, roles: [] };
    if (!m.roles.includes(role)) m.roles.push(role);
    this.store.memberships.set(key, m);
  }
  private studentCount(schoolId: Id) {
    let n = 0;
    for (const m of this.store.memberships.values()) if (m.schoolId === schoolId && m.roles.includes('student')) n++;
    return n;
  }
  private classSize(classId: Id) {
    let n = 0;
    for (const e of this.store.enrollments.values()) if (e.classId === classId) n++;
    return n;
  }
  private audit(actorId: Id, action: AuditAction, schoolId: Id | null, target: Id, detail?: Record<string, unknown>) {
    this.store.audit.push({ at: this.now(), actorId, action, schoolId, target, ...(detail ? { detail } : {}) });
  }
  private requireAdult(u: User, what: string) {
    if (u.ageBand !== 'adult') throw forbidden(`${what} chỉ dành cho tài khoản người lớn`);
  }

  // ───────────── danh tính ─────────────

  /**
   * Tạo tài khoản người lớn (dev/test; xác thực thật ở ADR-0005). Trẻ em KHÔNG tự đăng ký —
   * hồ sơ trẻ chỉ sinh qua `createManagedStudent` (CONSTITUTION §2).
   */
  registerUser(input: { displayName: string; ageBand?: AgeBand; planId?: PlanId; platformAdmin?: boolean }): User {
    if ((input.ageBand ?? 'adult') !== 'adult') throw forbidden('Trẻ em không tự đăng ký; giáo viên tạo hồ sơ cho lớp');
    const u: User = {
      id: this.id('user'),
      displayName: cleanName(input.displayName, 'Tên'),
      ageBand: 'adult',
      planId: input.planId ?? 'free',
      ...(input.platformAdmin ? { platformAdmin: true } : {}),
      createdAt: this.now(),
    };
    this.store.users.set(u.id, u);
    return u;
  }

  // ───────────── trường & vai ─────────────

  /** Mặc định `play` (không gian người lớn). `organization` sinh ở trạng thái chưa xác minh. */
  createSchool(actorId: Id, input: { name: string; level: SchoolLevel; kind?: SchoolKind; studentCapacity?: number }): School {
    const actor = this.user(actorId);
    this.requireAdult(actor, 'Lập trường');
    const lim = this.limitsFor(actor);
    const owned = [...this.store.schools.values()].filter((s) => s.ownerId === actorId).length;
    if (owned >= lim.maxOwnedSchools) throw quota(`Gói hiện tại cho làm chủ tối đa ${lim.maxOwnedSchools} trường`);
    const cap = input.studentCapacity ?? lim.maxStudentsPerSchool;
    if (cap < 1 || cap > lim.maxStudentsPerSchool) throw quota(`Sĩ số trường tối đa ${lim.maxStudentsPerSchool}`);
    const s: School = {
      id: this.id('school'),
      name: cleanName(input.name, 'Tên trường'),
      level: input.level,
      kind: input.kind ?? 'play',
      ownerId: actorId,
      studentCapacity: cap,
      createdAt: this.now(),
    };
    this.store.schools.set(s.id, s);
    this.addRole(s.id, actorId, 'principal');
    this.audit(actorId, 'school.create', s.id, s.id, { level: s.level, kind: s.kind });
    return s;
  }

  /** Quản trị nền tảng xác nhận đây là tổ chức có thật, giáo viên thật (quy trình xác minh: Q-13). */
  verifyOrganization(actorId: Id, schoolId: Id): School {
    if (!this.user(actorId).platformAdmin) throw forbidden('Chỉ quản trị nền tảng mới xác minh tổ chức');
    const s = this.school(schoolId);
    if (s.kind !== 'organization') throw invalid('Chỉ trường dạng tổ chức mới cần xác minh');
    if (s.verifiedAt) throw conflict('Tổ chức đã được xác minh');
    s.verifiedAt = this.now();
    s.verifiedBy = actorId;
    this.audit(actorId, 'school.verify', s.id, s.id);
    return s;
  }

  isVerifiedOrganization(s: School): boolean {
    return s.kind === 'organization' && s.verifiedAt !== undefined;
  }

  /** Hiệu trưởng cấp vai giáo viên trong trường của mình. MVP không cấp/chuyển vai hiệu trưởng (Q-05). */
  grantTeacher(actorId: Id, schoolId: Id, targetId: Id): void {
    this.school(schoolId);
    if (!this.hasRole(schoolId, actorId, 'principal')) throw forbidden('Chỉ hiệu trưởng của trường mới cấp quyền giáo viên');
    const target = this.user(targetId);
    this.requireAdult(target, 'Vai giáo viên');
    this.addRole(schoolId, targetId, 'teacher');
    this.audit(actorId, 'role.grant', schoolId, targetId, { role: 'teacher' });
  }

  /** Thu hồi vai giáo viên; phiên đang mở của lớp người đó dạy bị đóng ngay. */
  revokeTeacher(actorId: Id, schoolId: Id, targetId: Id): void {
    if (!this.hasRole(schoolId, actorId, 'principal')) throw forbidden('Chỉ hiệu trưởng của trường mới thu hồi quyền giáo viên');
    const m = this.store.memberships.get(`${schoolId}:${targetId}`);
    if (!m?.roles.includes('teacher')) throw notFound('vai giáo viên');
    m.roles = m.roles.filter((r) => r !== 'teacher');
    for (const s of this.store.sessions.values()) {
      if (s.schoolId === schoolId && s.teacherId === targetId && s.status === 'live') this.closeSession(s);
    }
    this.audit(actorId, 'role.revoke', schoolId, targetId, { role: 'teacher' });
  }

  // ───────────── lớp & ghi danh ─────────────

  createClass(actorId: Id, schoolId: Id, input: { name: string; capacity: number }): SchoolClass {
    const school = this.school(schoolId);
    if (!this.hasRole(schoolId, actorId, 'teacher')) throw forbidden('Chỉ giáo viên được cấp quyền của trường mới mở lớp');
    const lim = this.teachingLimits(this.user(actorId), school);
    const taught = [...this.store.classes.values()].filter((c) => c.teacherId === actorId).length;
    if (taught >= lim.maxTaughtClasses) throw quota(`Tối đa ${lim.maxTaughtClasses} lớp cho mỗi giáo viên`);
    if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > lim.maxClassSize) {
      throw quota(`Sĩ số lớp phải từ 1 đến ${lim.maxClassSize}`);
    }
    const c: SchoolClass = {
      id: this.id('class'),
      schoolId,
      name: cleanName(input.name, 'Tên lớp'),
      teacherId: actorId,
      capacity: input.capacity,
      joinCode: this.id('code'),
      createdAt: this.now(),
    };
    this.store.classes.set(c.id, c);
    this.audit(actorId, 'class.create', schoolId, c.id, { capacity: c.capacity });
    return c;
  }

  private enroll(c: SchoolClass, userId: Id, actorId: Id) {
    if (this.isEnrolled(c.id, userId)) throw conflict('Đã ở trong lớp này');
    if (c.teacherId === userId) throw conflict('Giáo viên không ghi danh làm học sinh lớp mình dạy');
    if (this.classSize(c.id) >= c.capacity) throw quota('Lớp đã đủ sĩ số');
    const school = this.school(c.schoolId);
    if (!this.hasRole(c.schoolId, userId, 'student') && this.studentCount(c.schoolId) >= school.studentCapacity) {
      throw quota('Trường đã đủ sĩ số');
    }
    this.addRole(c.schoolId, userId, 'student');
    this.store.enrollments.set(`${c.id}:${userId}`, { classId: c.id, userId, enrolledAt: this.now() });
    this.audit(actorId, 'enrollment.create', c.schoolId, c.id, { userId });
  }

  /** Mầm non: giáo viên tạo hồ sơ trẻ (chỉ tên hiển thị) và ghi danh luôn vào lớp. */
  createManagedStudent(actorId: Id, classId: Id, displayName: string): User {
    const c = this.klass(classId);
    if (!this.canManageClass(actorId, c)) throw forbidden('Chỉ giáo viên/hiệu trưởng của lớp mới tạo hồ sơ học sinh');
    if (!this.isVerifiedOrganization(this.school(c.schoolId))) {
      throw forbidden('Hồ sơ trẻ chỉ có ở tổ chức thật đã xác minh — trường chơi của người lớn không có trẻ');
    }
    const u: User = {
      id: this.id('user'),
      displayName: cleanName(displayName, 'Tên hiển thị'),
      ageBand: 'child',
      planId: 'free',
      managedBySchoolId: c.schoolId,
      createdAt: this.now(),
    };
    this.store.users.set(u.id, u);
    this.audit(actorId, 'student.create', c.schoolId, u.id);
    this.enroll(c, u.id, actorId);
    return u;
  }

  /**
   * Người lớn tự vào lớp **trường chơi** bằng mã. Lớp của tổ chức có trẻ không nhận người lớn làm học sinh
   * — không trộn người lớn với trẻ (ADR-0014). MVP không có danh bạ trường công khai (ADR-0007).
   */
  enrollWithCode(actorId: Id, joinCode: string): SchoolClass {
    this.user(actorId);
    const c = [...this.store.classes.values()].find((k) => k.joinCode === joinCode);
    if (!c) throw notFound('lớp với mã này');
    if (this.school(c.schoolId).kind === 'organization') {
      throw forbidden('Lớp của tổ chức chỉ nhận học sinh do giáo viên tạo hồ sơ');
    }
    this.enroll(c, actorId, actorId);
    return c;
  }

  // ───────────── phiên học trực tiếp ─────────────

  startSession(actorId: Id, classId: Id, lessonId: string): LessonSession {
    const c = this.klass(classId);
    if (!this.canManageClass(actorId, c)) throw forbidden('Chỉ giáo viên của lớp mới mở phiên học');
    for (const s of this.store.sessions.values()) if (s.classId === classId && s.status === 'live') throw conflict('Lớp đang có phiên học');
    const s: LessonSession = {
      id: this.id('session'),
      classId,
      schoolId: c.schoolId,
      lessonId,
      teacherId: actorId,
      status: 'live',
      currentActivityId: null,
      // Trường chơi (chỉ người lớn) mặc định chat mở; tổ chức có trẻ mặc định câu/sticker.
      chatMode: this.school(c.schoolId).kind === 'play' ? 'open' : 'phrases',
      participants: [actorId],
      startedAt: this.now(),
    };
    this.store.sessions.set(s.id, s);
    this.audit(actorId, 'session.start', c.schoolId, s.id, { lessonId });
    return s;
  }

  private live(sessionId: Id): LessonSession {
    const s = this.session(sessionId);
    if (s.status !== 'live') throw conflict('Phiên học đã đóng');
    return s;
  }
  private manageSession(actorId: Id, sessionId: Id) {
    const s = this.live(sessionId);
    if (!this.canManageClass(actorId, this.klass(s.classId))) throw forbidden('Chỉ giáo viên của lớp mới điều khiển phiên');
    return s;
  }

  joinSession(actorId: Id, sessionId: Id): LessonSession {
    const s = this.live(sessionId);
    const c = this.klass(s.classId);
    if (!this.isEnrolled(c.id, actorId) && !this.canManageClass(actorId, c)) throw forbidden('Chỉ học sinh của lớp mới vào phiên');
    if (!s.participants.includes(actorId)) s.participants.push(actorId);
    return s;
  }

  /** Giáo viên mở một hoạt động; học sinh chỉ nộp được cho hoạt động đang mở. */
  setActivity(actorId: Id, sessionId: Id, activityId: string): void {
    const s = this.manageSession(actorId, sessionId);
    s.currentActivityId = activityId;
    this.audit(actorId, 'session.activity', s.schoolId, s.id, { activityId });
  }

  submitResult(actorId: Id, sessionId: Id, activityId: string, response: unknown): ActivityResult {
    const s = this.live(sessionId);
    if (!s.participants.includes(actorId) || !this.isEnrolled(s.classId, actorId)) throw forbidden('Chỉ học sinh đã vào phiên mới nộp bài');
    if (s.currentActivityId !== activityId) throw conflict('Hoạt động này chưa mở hoặc đã qua');
    const key = `${s.id}:${actorId}:${activityId}`;
    const prev = this.store.results.get(key);
    const r: ActivityResult = {
      sessionId: s.id,
      classId: s.classId,
      lessonId: s.lessonId,
      userId: actorId,
      activityId,
      response,
      outcome: this.grade(s.lessonId, activityId, response),
      attempts: (prev?.attempts ?? 0) + 1,
      at: this.now(),
    };
    this.store.results.set(key, r);
    return r;
  }

  private closeSession(s: LessonSession) {
    s.status = 'ended';
    s.endedAt = this.now();
    s.currentActivityId = null;
  }

  endSession(actorId: Id, sessionId: Id): LessonSession {
    const s = this.manageSession(actorId, sessionId);
    this.closeSession(s);
    this.audit(actorId, 'session.end', s.schoolId, s.id);
    return s;
  }

  // ───────────── chat an toàn ─────────────

  setChatMode(actorId: Id, sessionId: Id, mode: ChatMode): void {
    const s = this.manageSession(actorId, sessionId);
    s.chatMode = mode;
    this.audit(actorId, 'chat.mode', s.schoolId, s.id, { mode });
  }

  sendChat(actorId: Id, sessionId: Id, payload: ChatPayload): ChatMessage {
    const s = this.live(sessionId);
    if (!s.participants.includes(actorId)) throw forbidden('Chỉ người trong phiên mới chat');
    const role: SchoolRole = this.canManageClass(actorId, this.klass(s.classId)) ? 'teacher' : 'student';
    const clean = checkChat(this.user(actorId), role, s.chatMode, payload, this.catalog);
    this.limiter.take(actorId, this.now());
    const m: ChatMessage = { id: this.id('message'), sessionId, senderId: actorId, payload: clean, at: this.now(), hidden: false };
    this.store.messages.set(m.id, m);
    return m;
  }

  /** Tin hiển thị cho người trong phiên (đã ẩn thì không trả). */
  chatLog(actorId: Id, sessionId: Id): ChatMessage[] {
    const s = this.session(sessionId);
    if (!s.participants.includes(actorId)) throw forbidden('Chỉ người trong phiên mới xem chat');
    return [...this.store.messages.values()].filter((m) => m.sessionId === sessionId && !m.hidden);
  }

  hideMessage(actorId: Id, messageId: Id): void {
    const m = this.store.messages.get(messageId);
    if (!m) throw notFound('tin nhắn');
    const s = this.session(m.sessionId);
    if (!this.canManageClass(actorId, this.klass(s.classId))) throw forbidden('Chỉ giáo viên của lớp mới ẩn tin');
    m.hidden = true;
    this.audit(actorId, 'chat.hide', s.schoolId, messageId);
  }

  report(actorId: Id, messageId: Id, reason: string): ModerationReport {
    const m = this.store.messages.get(messageId);
    if (!m) throw notFound('tin nhắn');
    const s = this.session(m.sessionId);
    if (!s.participants.includes(actorId)) throw forbidden('Chỉ người trong phiên mới báo cáo');
    const r: ModerationReport = {
      id: this.id('report'),
      schoolId: s.schoolId,
      reporterId: actorId,
      messageId,
      reason: reason.slice(0, 200),
      status: 'open',
      at: this.now(),
    };
    this.store.reports.set(r.id, r);
    this.audit(actorId, 'report.create', s.schoolId, r.id);
    return r;
  }

  // ───────────── xem dữ liệu theo quyền ─────────────

  classProgress(actorId: Id, classId: Id): ActivityResult[] {
    const c = this.klass(classId);
    if (!this.canManageClass(actorId, c)) throw forbidden('Chỉ giáo viên/hiệu trưởng của lớp mới xem tiến độ cả lớp');
    return [...this.store.results.values()].filter((r) => r.classId === classId);
  }

  myProgress(actorId: Id): ActivityResult[] {
    return [...this.store.results.values()].filter((r) => r.userId === actorId);
  }

  schoolReports(actorId: Id, schoolId: Id): ModerationReport[] {
    if (!this.hasRole(schoolId, actorId, 'principal')) throw forbidden('Chỉ hiệu trưởng xem báo cáo của trường');
    return [...this.store.reports.values()].filter((r) => r.schoolId === schoolId);
  }

  schoolAudit(actorId: Id, schoolId: Id) {
    if (!this.hasRole(schoolId, actorId, 'principal')) throw forbidden('Chỉ hiệu trưởng xem nhật ký kiểm toán của trường');
    return this.store.audit.filter((e) => e.schoolId === schoolId);
  }
}
