import { describe, expect, it } from 'vitest';
import { SchoolService, createMemoryStore, type Id } from '@lhdk/domain';
import { seedDevCampus, type DevSeedCtx } from '../src/rooms/campus-dev-seed.js';

const makeCtx = () => {
  const labels = new Map<string, Id>();
  const linked: string[] = [];
  let flushes = 0;
  const service = new SchoolService({ store: createMemoryStore() });
  const ctx: DevSeedCtx = {
    service,
    flush: async () => void flushes++,
    devUserId: (l) => labels.get(l),
    linkDevIdentity: async (l, id) => {
      linked.push(l);
      labels.set(l, id);
    },
  };
  return { ctx, labels, linked, service, flushes: () => flushes };
};

const allLabels = Array.from({ length: 30 }, (_, i) => `u${String(i + 1).padStart(2, '0')}`);

describe('seedDevCampus', () => {
  it('tạo đủ nhãn u01..u30, mỗi nhãn liên kết đúng một lần, flush cuối cùng', async () => {
    const { ctx, labels, linked, flushes } = makeCtx();
    await seedDevCampus(ctx);
    expect([...labels.keys()].sort()).toEqual(allLabels);
    expect(linked.slice().sort()).toEqual(allLabels);
    expect(flushes()).toBe(1);
  });

  it('gọi lần hai không tạo thêm user nào', async () => {
    const { ctx, service, linked, flushes } = makeCtx();
    await seedDevCampus(ctx);
    const users = service.store.users.size;
    await seedDevCampus(ctx);
    expect(service.store.users.size).toBe(users);
    expect(users).toBe(30);
    expect(linked).toHaveLength(30);
    expect(flushes()).toBe(1);
  });

  it('không có hồ sơ trẻ', async () => {
    const { ctx, service } = makeCtx();
    await seedDevCampus(ctx);
    for (const u of service.store.users.values()) expect(u.ageBand).not.toBe('child');
  });

  it('cấu trúc: 1 trường play với 2 lớp sức chứa 20, u30 chỉ thuộc trường organization chưa xác minh', async () => {
    const { ctx, service, labels } = makeCtx();
    await seedDevCampus(ctx);
    const schools = [...service.store.schools.values()];
    const play = schools.filter((s) => s.kind === 'play');
    const org = schools.filter((s) => s.kind === 'organization');
    expect(play).toHaveLength(1);
    expect(org).toHaveLength(1);
    expect(org[0]!.verifiedAt).toBeUndefined();

    const classes = [...service.store.classes.values()];
    expect(classes).toHaveLength(2);
    expect(classes.every((c) => c.capacity === 20 && c.schoolId === play[0]!.id && c.teacherId === labels.get('u02'))).toBe(true);
    expect(service.hasRole(play[0]!.id, labels.get('u01')!, 'principal')).toBe(true);
    expect(service.hasRole(play[0]!.id, labels.get('u02')!, 'teacher')).toBe(true);

    const u30 = labels.get('u30')!;
    const memberships = [...service.store.memberships.values()].filter((m) => m.userId === u30);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.schoolId).toBe(org[0]!.id);
    expect(service.store.users.get(u30)!.planId).toBe('pilot');

    // u03..u29 đều là học viên của đúng một trường play, chia đều 2 lớp.
    const perClass = classes.map((c) => [...service.store.enrollments.values()].filter((e) => e.classId === c.id).length);
    expect(perClass.sort()).toEqual([13, 14]);
  });
});
