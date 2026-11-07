/** Giới hạn tầng mạng cho mọi room (SAFETY T8: chặn spam/DoS sự kiện qua WebSocket). */
export const LIMITS = {
  /** Kích thước tối đa một khung WebSocket; vượt thì `ws` đóng kết nối (1009). */
  wsMaxPayloadBytes: 4096,
  /** Dung lượng bucket: số tin dồn tối đa trước khi bị bỏ. */
  msgBurst: 20,
  /** Tốc độ hồi bucket (tin/giây). */
  msgPerSecond: 15,
  /** Số tin bị bỏ trong `dropWindowMs` thì đá khỏi room. */
  dropsBeforeKick: 60,
  dropWindowMs: 10_000,
  /** Mã đóng kết nối ứng dụng khi bị đá vì spam. */
  kickCode: 4029,
} as const;
