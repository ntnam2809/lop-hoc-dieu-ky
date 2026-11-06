// Bản sao hằng số hợp đồng spike (client KHÔNG import từ apps/server).
export const ROOM = 'campus';
export const WORLD_W = 1280;
export const WORLD_H = 720;
export const SERVER_MAX_SPEED = 220; // px/s, trần phía server
export const CLIENT_SPEED = 200; // px/s, dưới trần
export const MAX_CLIENTS = 20;
export const RECONNECT_WINDOW_MS = 30_000; // server giữ chỗ
export const MOVE_HZ = 10;
export const INTERP_DELAY_MS = 100;
export const DEFAULT_PORT = 2567;
export const TOKEN_KEY = 'lhdk.campus.reconnectionToken';

export type Status = 'connecting' | 'waking' | 'connected' | 'reconnecting' | 'failed';

export interface MoveMsg { x: number; y: number; seq: number }
export interface CorrectMsg { x: number; y: number; seq: number }
export interface PlayerRow { id: string; displayName: string; x: number; y: number; lastSeq: number }
export interface PublicPlayer { id: string; displayName: string; x: number; y: number }

export interface CampusState {
  status: Status;
  connected: boolean;
  self: { id: string; x: number; y: number } | null;
  players: PublicPlayer[];
  fps: number;
  rtt: number | null;
}

export const STATUS_LABEL: Partial<Record<Status, string>> = {
  connecting: 'Đang kết nối…',
  waking: 'Máy chủ đang khởi động, chờ chút nhé…',
  reconnecting: 'Đang kết nối lại…',
  failed: 'Không kết nối được máy chủ.',
};
