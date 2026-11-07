import { CAMPUS_MAX_OCCUPANCY } from '@lhdk/domain';

// Hằng số hợp đồng spike. Client giữ bản sao riêng; server là nguồn sự thật.
export const ROOM = 'campus';
export const WORLD = { w: 1280, h: 720 } as const;
export const MAX_SPEED = 220; // px/s
export const SLACK_PX = 4;
export const MAX_DT_MS = 500;
// Xô ngân sách quãng đường: tích luỹ MAX_SPEED px/s, trần 0.25 s tốc độ tối đa (55 px).
// Chịu được jitter mạng/tab (message dồn) mà tốc độ dài hạn vẫn bị chặn.
export const BUDGET_CAP = MAX_SPEED * 0.25;
export const RECONNECT_S = 30;
// Trần người mỗi instance = CAMPUS_MAX_OCCUPANCY của domain (nguồn sự thật, ADR-0017).
// Production luôn dùng trần domain; ngoài production, CAMPUS_MAX_CLIENTS (số nguyên 1..100) chỉ để đo stress.
export function resolveMaxClients(env: { NODE_ENV?: string | undefined; CAMPUS_MAX_CLIENTS?: string | undefined }): number {
  if (env.NODE_ENV === 'production') return CAMPUS_MAX_OCCUPANCY;
  const raw = env.CAMPUS_MAX_CLIENTS;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return CAMPUS_MAX_OCCUPANCY;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 && n <= 100 ? n : CAMPUS_MAX_OCCUPANCY;
}
export const MAX_CLIENTS = resolveMaxClients(process.env);
// Ticket chỗ ngồi: sống 15 giây, dùng một lần (cũng là thời gian giữ chỗ pending trong sổ instance).
export const SEAT_TTL_MS = 15_000;
// Ghế do Colyseus giữ (giây): luôn ngắn hơn SEAT_TTL_MS ít nhất 3 s để sổ instance không bao giờ đếm thiếu so với Colyseus.
export const SEAT_COLYSEUS_S = 10;
// Campus của trường dạng tổ chức đóng cho tới khi Q-02/Q-13 có quyết định; chưa có đăng nhập cho trẻ.
export const CAMPUS_ORG_ENABLED = false;
