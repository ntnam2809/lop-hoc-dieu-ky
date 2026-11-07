import { forbidden, invalid, quota } from './errors';
import { LIVE_SESSION_MAX_PARTICIPANTS } from './plans';
import type { SchoolService } from './service';
import type { AgeBand, Id, SchoolKind, SchoolRole } from './types';

/**
 * Luật vào campus 2D và gán instance. Thuần, tất định: không đồng hồ, không ngẫu nhiên, không I/O.
 * Trần người mỗi instance kể cả giáo viên theo ADR-0017; hai không gian tách hẳn theo ADR-0014;
 * người đang livestream không vào trường tổ chức (ADR-0015).
 */

/** Trần người trong một instance campus (kể cả giáo viên). */
export const CAMPUS_MAX_OCCUPANCY = LIVE_SESSION_MAX_PARTICIPANTS;

export interface CampusEntry {
  userId: Id;
  schoolId: Id;
  kind: SchoolKind;
  ageBand: AgeBand;
  roles: SchoolRole[];
  displayName: string;
}

/** Kiểm quyền vào campus của một trường; ném DomainError nếu không được vào. */
export function checkCampusEntry(svc: SchoolService, userId: Id, schoolId: Id, opts: { streaming: boolean }): CampusEntry {
  const user = svc.user(userId);
  const school = svc.school(schoolId);
  const roles = [...svc.rolesIn(schoolId, userId)];
  if (roles.length === 0) throw forbidden('Chỉ thành viên trường mới vào campus');

  if (school.kind === 'play') {
    // Phòng thủ kép: API không tạo được trẻ ở trường chơi, nhưng luật vẫn chặn.
    if (user.ageBand === 'child') throw forbidden('Trường chơi chỉ dành cho người lớn');
  } else {
    if (opts.streaming) throw forbidden('Đang livestream thì không vào trường tổ chức');
    if (user.ageBand === 'child') {
      const ok = svc.isVerifiedOrganization(school) && user.managedBySchoolId === schoolId && roles.includes('student');
      if (!ok) throw forbidden('Học sinh chỉ vào campus của tổ chức đã xác minh mà hồ sơ thuộc về');
    } else if (!roles.includes('principal') && !roles.includes('teacher')) {
      throw forbidden('Người lớn ở trường tổ chức chỉ vào campus với vai hiệu trưởng hoặc giáo viên');
    }
  }

  return { userId, schoolId, kind: school.kind, ageBand: user.ageBand, roles, displayName: user.displayName };
}

/** Các lớp (id, đã sort tăng) thuộc trường mà user được ghi danh hoặc là giáo viên phụ trách. */
export function campusAffinity(svc: SchoolService, userId: Id, schoolId: Id): string[] {
  const out: string[] = [];
  for (const c of svc.store.classes.values()) {
    if (c.schoolId !== schoolId) continue;
    if (c.teacherId === userId || svc.isEnrolled(c.id, userId)) out.push(c.id);
  }
  return out.sort();
}

export function campusInstanceId(schoolId: Id, seq: number): string {
  return `campus:${schoolId}:${seq}`;
}

export interface CampusOccupant {
  userId: Id;
  affinity: readonly string[];
}

/** `occupants` gồm cả người đang kết nối, đang giữ chỗ reconnect và chỗ đã cấp chưa vào — tất cả đều chiếm chỗ. */
export interface CampusInstanceView {
  instanceId: string;
  schoolId: Id;
  kind: SchoolKind;
  seq: number;
  occupants: readonly CampusOccupant[];
}

export interface CampusAssignRequest {
  userId: Id;
  schoolId: Id;
  kind: SchoolKind;
  affinity: readonly string[];
}

export type CampusAssignment = { action: 'rejoin' | 'join' | 'create'; instanceId: string; seq: number };

const isPosInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1;

/**
 * Chọn instance cho người vào campus. Kết quả không phụ thuộc thứ tự mảng đầu vào, không đột biến đầu vào.
 * Thứ tự luật: rejoin → join (ưu tiên chung lớp, rồi seq nhỏ) → create (hoặc QUOTA nếu chạm trần số instance).
 */
export function assignCampusInstance(
  instances: readonly CampusInstanceView[],
  req: CampusAssignRequest,
  opts: { cap?: number; maxInstances?: number } = {},
): CampusAssignment {
  const cap = opts.cap ?? CAMPUS_MAX_OCCUPANCY;
  if (!isPosInt(cap)) throw invalid('Trần người mỗi instance phải là số nguyên ≥ 1');
  const maxInstances = opts.maxInstances;
  if (maxInstances !== undefined && !isPosInt(maxInstances)) throw invalid('Số instance tối đa phải là số nguyên ≥ 1');

  // Tách hẳn không gian: chỉ xét đúng trường và đúng loại.
  const valid = instances.filter((i) => i.schoolId === req.schoolId && i.kind === req.kind).sort((a, b) => a.seq - b.seq);

  const existing = valid.find((i) => i.occupants.some((o) => o.userId === req.userId));
  if (existing) return { action: 'rejoin', instanceId: existing.instanceId, seq: existing.seq };

  const mine = new Set(req.affinity);
  let best: CampusInstanceView | null = null;
  let bestScore = -1;
  for (const i of valid) {
    if (i.occupants.length >= cap) continue;
    const score = i.occupants.filter((o) => o.affinity.some((a) => mine.has(a))).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best) return { action: 'join', instanceId: best.instanceId, seq: best.seq };

  if (maxInstances !== undefined && valid.length >= maxInstances) throw quota(`Trường đã đạt tối đa ${maxInstances} instance campus`);

  const used = new Set(valid.map((i) => i.seq));
  let seq = 1;
  while (used.has(seq)) seq++;
  return { action: 'create', instanceId: campusInstanceId(req.schoolId, seq), seq };
}
