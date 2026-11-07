import { createServer } from 'node:http';
import { Server, matchMaker } from '@colyseus/core';
import { createApp, type AppContext } from './app.js';
import { ConfigError, loadConfig, type Config } from './config.js';
import { createApi } from './http/api.js';
import { mountHttp } from './http/node-adapter.js';
import { createSeatHandler } from './http/seat.js';
import { createTransport } from './net/transport.js';
import { seedDevCampus } from './rooms/campus-dev-seed.js';
import { registerRooms } from './rooms/index.js';

type ExpressRes = { status(n: number): { type(t: string): { send(b: string): void } } };
type ExpressApp = {
  get(path: string, h: (req: unknown, res: ExpressRes) => void): void;
  use: Parameters<typeof mountHttp>[0]['use'];
};

/**
 * Colyseus gắn CORS cho MỌI request (ACAO "*" hoặc phản chiếu Origin) trước cả express, và tự trả lời OPTIONS.
 * Thu lại về allowlist: Origin lạ không nhận header CORS. Trạng thái toàn tiến trình của matchMaker.controller.
 */
function restrictCors(allowedOrigins: string[]): void {
  const allowed = new Set(allowedOrigins);
  const c = matchMaker.controller;
  delete (c.DEFAULT_CORS_HEADERS as Record<string, string>)['Access-Control-Allow-Origin'];
  delete (c.DEFAULT_CORS_HEADERS as Record<string, string>)['Access-Control-Allow-Credentials'];
  c.getCorsHeaders = (headers: Headers) => {
    const origin = headers.get('origin');
    const out: Record<string, string> = {};
    if (origin !== null && allowed.has(origin)) {
      out['Access-Control-Allow-Origin'] = origin;
      // SDK Colyseus gọi /matchmake với credentials: 'include'; chỉ cho Origin trong allowlist.
      out['Access-Control-Allow-Credentials'] = 'true';
      out.Vary = 'Origin';
    }
    return out;
  };
}

/** Nơi duy nhất dựng transport và mount HTTP. */
export async function startServer(port: number, o: { config?: Config; app?: AppContext } = {}) {
  const config = o.config ?? o.app?.config ?? loadConfig({ ...process.env, PORT: String(port) });
  const ctx = o.app ?? (await createApp(config));
  restrictCors(config.allowedOrigins);
  const http = createServer();
  // Hook express có thể chạy trước khi registerRooms xong; dựng handler ghế ở lần gọi đầu.
  let seat: ReturnType<typeof createSeatHandler> | undefined;
  const server = new Server({
    transport: createTransport({
      server: http,
      maxPayloadBytes: config.wsMaxPayloadBytes,
      allowedOrigins: config.allowedOrigins,
      allowMissingOrigin: config.allowMissingOrigin,
    }),
    // Colyseus 0.18 gắn express làm listener "request" của http; đăng ký thêm
    // listener riêng sẽ đè route matchmaking, nên /health và HTTP API đi qua hook này.
    express: (app: ExpressApp) => {
      app.get('/health', (_req, res) => {
        res.status(200).type('text/plain').send('ok');
      });
      mountHttp(
        app,
        [
          { prefix: '/v1/', handle: createApi({ ...ctx }) },
          { prefix: '/campus/seat', handle: (req) => (seat ??= createSeatHandler(ctx, rooms.campus))(req) },
        ],
        config,
      );
    },
  });
  const rooms = registerRooms(server, ctx);
  if (config.auth === 'dev' && config.nodeEnv !== 'production') await seedDevCampus(ctx);
  await server.listen(port);
  return { server, http, ctx };
}

// Chạy trực tiếp (tsx src/index.ts), không chạy khi được import trong test.
if (process.argv[1] && /src[\\/]index\.ts$/.test(process.argv[1])) {
  try {
    const port = Number(process.env.PORT) || 2567;
    await startServer(port);
    console.log(`[campus] listening on :${port}`);
    // Colyseus (gracefullyShutdown mặc định bật) đã tự bắt SIGINT/SIGTERM và thoát gọn.
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`[campus] ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}
