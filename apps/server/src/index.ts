import { createServer } from "node:http";
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM } from './sim/constants.js';
import { CampusRoom } from './rooms/campus-room.js';

type ExpressRes = { status(n: number): { type(t: string): { send(b: string): void } } };

export async function startServer(port: number) {
  const http = createServer();
  const server = new Server({
    transport: new WebSocketTransport({ server: http }),
    // Colyseus 0.18 gắn express làm listener "request" của http; đăng ký thêm
    // listener riêng sẽ đè route matchmaking, nên /health đi qua hook này.
    express: (app: { get(path: string, h: (req: unknown, res: ExpressRes) => void): void }) => {
      app.get("/health", (_req: unknown, res: ExpressRes) => {
        res.status(200).type('text/plain').send('ok');
      });
    },
  });
  server.define(ROOM, CampusRoom);
  await server.listen(port);
  return { server, http };
}

// Chạy trực tiếp (tsx src/index.ts), không chạy khi được import trong test.
if (process.argv[1] && /src[\\/]index\.ts$/.test(process.argv[1])) {
  const port = Number(process.env.PORT) || 2567;
  await startServer(port);
  console.log(`[campus] listening on :${port}`);
  // Colyseus (gracefullyShutdown mặc định bật) đã tự bắt SIGINT/SIGTERM và thoát gọn.
}
