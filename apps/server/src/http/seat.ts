import { DomainError } from '@lhdk/domain';
import { z } from 'zod';
import type { AppContext } from '../app.js';
import { reserveCampusSeat, type CampusDeps } from '../rooms/campus-seat.js';
import { parseJsonBody, readBearer, toErrorResponse, type ApiRequest, type ApiResponse } from './api.js';

const SeatBody = z
  .object({ schoolId: z.string().min(1).max(64).optional(), streaming: z.boolean().optional() })
  .strict();

/** POST /campus/seat: xác thực → rate limit → xin ghế. Ticket chỉ nằm trong body trả về, không vào log. */
export function createSeatHandler(ctx: AppContext, campus: CampusDeps): (req: ApiRequest) => Promise<ApiResponse> {
  return async (req) => {
    const t0 = ctx.clock();
    const isSeat = req.method === 'POST' && req.path.split('?')[0] === '/campus/seat';
    let userId: string | undefined;
    let res: ApiResponse;
    try {
      if (!isSeat) {
        res = { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Không tìm thấy đường dẫn' } } };
      } else {
        const token = readBearer(req.headers);
        userId = (await ctx.authenticate(token)).userId;
        ctx.limiter.take(userId, ctx.clock());
        const body = parseJsonBody(SeatBody, req.body ?? {});
        const seat = await reserveCampusSeat(campus, {
          userId,
          ...(body.schoolId !== undefined ? { schoolId: body.schoolId } : {}),
          streaming: body.streaming ?? false,
        });
        res = { status: 200, body: seat };
      }
    } catch (e) {
      if (e instanceof DomainError && e.code === 'QUOTA') {
        // Campus đầy: thử lại được, nên 429 (riêng route này).
        res = { status: 429, body: { error: { code: 'QUOTA', message: e.message } } };
      } else {
        res = toErrorResponse(e, ctx.log);
      }
    }
    ctx.log.info('http.request', {
      route: '/campus/seat',
      method: req.method,
      status: res.status,
      ms: Math.max(0, ctx.clock() - t0),
      ...(userId ? { userId } : {}),
    });
    return res;
  };
}
