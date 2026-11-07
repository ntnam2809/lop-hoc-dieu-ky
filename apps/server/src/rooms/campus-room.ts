import { Room, type Client } from '@colyseus/core';
import { z } from 'zod';
import { BUDGET_CAP, MAX_CLIENTS, RECONNECT_S, WORLD } from '../sim/constants.js';
import { sanitizeName, validateMove } from '../sim/movement.js';
import { CampusState, Player } from './campus-state.js';

const MoveMsg = z.object({ x: z.number(), y: z.number(), seq: z.number().int().nonnegative().max(0xffffffff) }); // lastSeq là uint32 trong schema

export class CampusRoom extends Room {
  maxClients = MAX_CLIENTS;
  state = new CampusState();
  // Trạng thái nội bộ (không vào Schema): ngân sách quãng đường + mốc tích luỹ.
  private internal = new Map<string, { budget: number; t: number }>();

  onCreate() {
    console.log('[campus] room created', this.roomId);
    this.onMessage('move', (client, raw) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const parsed = MoveMsg.safeParse(raw);
      const now = Date.now();
      const st = this.internal.get(client.sessionId) ?? { budget: BUDGET_CAP, t: now };
      const res = parsed.success
        ? validateMove(
            { x: p.x, y: p.y, t: st.t, budget: st.budget, lastSeq: p.lastSeq },
            parsed.data,
            now,
          )
        : ({ ok: false, reason: 'invalid', budget: st.budget, t: st.t } as const);
      this.internal.set(client.sessionId, { budget: res.budget, t: res.t });
      if (res.ok && parsed.success) {
        p.x = res.x;
        p.y = res.y;
        p.lastSeq = parsed.data.seq;
      } else {
        const seq = parsed.success ? parsed.data.seq : 0;
        if (process.env.CAMPUS_LOG_CORRECT) console.log(`[campus] correct ${res.ok ? 'invalid' : res.reason} seq=${seq}`);
        client.send('correct', { x: p.x, y: p.y, seq });
      }
    });
  }

  onJoin(client: Client, options: unknown) {
    const raw = (options as { name?: unknown } | undefined)?.name;
    const p = new Player();
    p.id = client.sessionId;
    p.displayName = sanitizeName(raw, client.sessionId);
    p.x = WORLD.w * (0.25 + Math.random() * 0.5);
    p.y = WORLD.h * (0.25 + Math.random() * 0.5);
    p.lastSeq = 0;
    this.state.players.set(client.sessionId, p);
    this.internal.set(client.sessionId, { budget: BUDGET_CAP, t: Date.now() });
    console.log(`[campus] join ${client.sessionId} n=${this.state.players.size}`); // log chỉ id (ADR-0013)
  }

  // 0.18: onDrop = mất kết nối không chủ động; onLeave = rời hẳn (kể cả hết hạn giữ chỗ).
  async onDrop(client: Client) {
    console.log(`[campus] drop ${client.sessionId}, giữ chỗ ${RECONNECT_S}s`);
    try {
      await this.allowReconnection(client, RECONNECT_S);
      const st = this.internal.get(client.sessionId);
      if (st) st.t = Date.now();
      console.log(`[campus] reconnected ${client.sessionId}`);
    } catch {
      console.log(`[campus] reconnect expired ${client.sessionId}`);
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.internal.delete(client.sessionId);
    console.log(`[campus] leave ${client.sessionId} n=${this.state.players.size}`);
  }
}
