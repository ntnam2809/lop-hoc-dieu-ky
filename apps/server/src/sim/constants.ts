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
// 20 khớp LIVE_SESSION_MAX_PARTICIPANTS của packages/domain (không import domain).
// Biến môi trường chỉ để đo stress (vd 30).
export const MAX_CLIENTS = Number(process.env.CAMPUS_MAX_CLIENTS) || 20;
