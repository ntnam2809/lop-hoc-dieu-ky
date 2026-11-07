import type { Id, SchoolService } from '@lhdk/domain';

/**
 * Dữ liệu dev cho campus: toàn người lớn, không hồ sơ trẻ. Chỉ gọi API domain công khai.
 * Nhãn u01..u30 do tầng dev-auth ánh xạ sang danh tính dev.
 */
export type DevSeedCtx = {
  service: SchoolService;
  flush(): Promise<void>;
  devUserId(label: string): Id | undefined;
  linkDevIdentity(label: string, userId: Id): void | Promise<void>;
};

const label = (n: number) => `u${String(n).padStart(2, '0')}`;
const CLASS_CAPACITY = 20;

export async function seedDevCampus(ctx: DevSeedCtx): Promise<void> {
  if (ctx.devUserId('u01') !== undefined) return;
  const svc = ctx.service;
  const make = async (n: number, planId: 'free' | 'pilot' = 'free') => {
    const l = label(n);
    const u = svc.registerUser({ displayName: `Dev ${l}`, planId });
    await ctx.linkDevIdentity(l, u.id);
    return u;
  };

  // u01: hiệu trưởng trường chơi; u02: giáo viên do u01 cấp vai, mở 2 lớp.
  const principal = await make(1, 'pilot');
  const school = svc.createSchool(principal.id, { name: 'Trường Dev', level: 'primary', kind: 'play' });
  const teacher = await make(2);
  svc.grantTeacher(principal.id, school.id, teacher.id);
  const classes = [
    svc.createClass(teacher.id, school.id, { name: 'Lớp Dev A', capacity: CLASS_CAPACITY }),
    svc.createClass(teacher.id, school.id, { name: 'Lớp Dev B', capacity: CLASS_CAPACITY }),
  ];

  // u03..u29: người lớn ghi danh bằng mã lớp, chia đều 2 lớp.
  for (let n = 3; n <= 29; n++) {
    const u = await make(n);
    svc.enrollWithCode(u.id, classes[(n - 3) % 2]!.joinCode);
  }

  // u30: hiệu trưởng một tổ chức chưa xác minh, không thuộc trường chơi.
  const orgHead = await make(30, 'pilot');
  svc.createSchool(orgHead.id, { name: 'Tổ chức Dev', level: 'kindergarten', kind: 'organization' });

  await ctx.flush();
}
