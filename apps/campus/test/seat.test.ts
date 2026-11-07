import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ joinById: vi.fn(), reconnect: vi.fn() }));
vi.mock('@colyseus/sdk', () => ({
  Client: class {
    joinById = sdk.joinById;
    reconnect = sdk.reconnect;
  },
}));

import { createNet } from '../src/net/client';
import { createSeatRequester, type SeatResult } from '../src/net/seat';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('createSeatRequester', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { vi.unstubAllGlobals(); });

  const make = (extra: { schoolId?: string; streaming?: boolean } = {}) =>
    createSeatRequester({ server: 'ws://localhost:2567', getToken: async () => 'tok-1', ...extra });

  it('200 -> ok kèm roomId, ticket', async () => {
    fetchMock.mockResolvedValue(json(200, { roomId: 'r1', ticket: 't1', instanceId: 'i1' }));
    expect(await make()()).toEqual({ ok: true, roomId: 'r1', ticket: 't1' });
  });

  it.each([400, 401, 403, 404])('%i -> denied', async (status) => {
    fetchMock.mockResolvedValue(json(status, { error: { code: 'X', message: 'm' } }));
    expect(await make()()).toEqual({ ok: false, kind: 'denied', status });
  });

  it.each([409, 429])('%i -> busy', async (status) => {
    fetchMock.mockResolvedValue(json(status, { error: { code: status === 429 ? 'QUOTA' : 'CONFLICT', message: 'm' } }));
    expect(await make()()).toEqual({ ok: false, kind: 'busy', status });
  });

  it('429 RATE_LIMITED cũng là busy', async () => {
    fetchMock.mockResolvedValue(json(429, { error: { code: 'RATE_LIMITED', message: 'm' } }));
    expect((await make()()).ok).toBe(false);
    expect(await make()()).toMatchObject({ kind: 'busy' });
  });

  it('fetch ném lỗi -> network', async () => {
    fetchMock.mockRejectedValue(new TypeError('failed'));
    expect(await make()()).toEqual({ ok: false, kind: 'network' });
  });

  it('503 -> network', async () => {
    fetchMock.mockResolvedValue(json(503, {}));
    expect(await make()()).toEqual({ ok: false, kind: 'network', status: 503 });
  });

  it('gửi đúng URL, header Authorization và body', async () => {
    fetchMock.mockResolvedValue(json(200, { roomId: 'r', ticket: 't', instanceId: 'i' }));
    await make({ schoolId: 'sch-1', streaming: true })();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:2567/campus/seat');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-1');
    expect(JSON.parse(init.body)).toEqual({ schoolId: 'sch-1', streaming: true });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('wss -> https; không truyền schoolId thì body không có khoá schoolId', async () => {
    fetchMock.mockResolvedValue(json(200, { roomId: 'r', ticket: 't', instanceId: 'i' }));
    await createSeatRequester({ server: 'wss://host.example', getToken: async () => 'k' })();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://host.example/campus/seat');
    expect(Object.keys(JSON.parse(init.body))).not.toContain('schoolId');
  });
});

describe('createNet + requestSeat', () => {
  beforeEach(() => { vi.useFakeTimers(); sdk.joinById.mockReset(); sdk.reconnect.mockReset(); });
  afterEach(() => { vi.useRealTimers(); });

  const fakeRoom = () => ({
    reconnection: { minUptime: 5000, delay: 0 },
    reconnectionToken: 'rt',
    sessionId: 'me',
    state: undefined,
    onStateChange: vi.fn(),
    onMessage: vi.fn(),
    onDrop: vi.fn(),
    onReconnect: vi.fn(),
    onLeave: vi.fn(),
    ping: vi.fn(),
    removeAllListeners: vi.fn(),
    leave: vi.fn(async () => {}),
    connection: { isOpen: true, close: vi.fn() },
  });

  const netOpts = (requestSeat: () => Promise<SeatResult>, onStatus = vi.fn()) => ({
    server: 'ws://localhost:2567',
    requestSeat,
    onStatus,
    onPlayers: vi.fn(),
    onJoined: vi.fn(),
    onCorrect: vi.fn(),
  });

  it('joinById đầu ném lỗi -> xin ghế lại (busy, không denied)', async () => {
    const requestSeat = vi.fn(async (): Promise<SeatResult> => ({ ok: true, roomId: 'r1', ticket: 't1' }));
    const room = fakeRoom();
    sdk.joinById.mockRejectedValueOnce(new Error('room not found')).mockResolvedValueOnce(room);
    const onStatus = vi.fn();
    const net = createNet(netOpts(requestSeat, onStatus));
    await vi.advanceTimersByTimeAsync(0);
    expect(requestSeat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(requestSeat).toHaveBeenCalledTimes(2);
    expect(sdk.joinById).toHaveBeenCalledTimes(2);
    expect(sdk.joinById).toHaveBeenLastCalledWith('r1', { ticket: 't1' });
    expect(onStatus).not.toHaveBeenCalledWith('denied');
    expect(onStatus).toHaveBeenLastCalledWith('connected');
    expect(room.reconnection.minUptime).toBe(0);
    net.destroy();
  });

  it('denied -> dừng hẳn, không thử lại', async () => {
    const requestSeat = vi.fn(async (): Promise<SeatResult> => ({ ok: false, kind: 'denied', status: 403 }));
    const onStatus = vi.fn();
    const net = createNet(netOpts(requestSeat, onStatus));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(requestSeat).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenLastCalledWith('denied');
    expect(sdk.joinById).not.toHaveBeenCalled();
    net.destroy();
  });

  it('busy -> thử lại theo retryDelay', async () => {
    const requestSeat = vi.fn(async (): Promise<SeatResult> => ({ ok: false, kind: 'busy', status: 429 }));
    const net = createNet(netOpts(requestSeat));
    await vi.advanceTimersByTimeAsync(0);
    expect(requestSeat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4000);
    expect(requestSeat).toHaveBeenCalledTimes(3);
    net.destroy();
  });

  it('đóng với 4409 -> replaced, không vào lại', async () => {
    const requestSeat = vi.fn(async (): Promise<SeatResult> => ({ ok: true, roomId: 'r1', ticket: 't1' }));
    const room = fakeRoom();
    sdk.joinById.mockResolvedValue(room);
    const onStatus = vi.fn();
    const net = createNet(netOpts(requestSeat, onStatus));
    await vi.advanceTimersByTimeAsync(0);
    const onLeave = room.onLeave.mock.calls[0]![0] as (code: number) => void;
    onLeave(4409);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onStatus).toHaveBeenLastCalledWith('replaced');
    expect(requestSeat).toHaveBeenCalledTimes(1);
    net.destroy();
  });
});
