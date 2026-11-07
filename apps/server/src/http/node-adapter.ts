import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Config } from '../config.js';
import type { ApiRequest, ApiResponse } from './api.js';

export interface HttpRoute {
  prefix: string;
  handle: (req: ApiRequest) => Promise<ApiResponse>;
}

type Req = IncomingMessage & { body?: unknown; originalUrl?: string };
type Next = () => void;
/** app.use của express (hoặc tương đương). */
export interface UseApp {
  use(handler: (req: Req, res: ServerResponse, next: Next) => void): unknown;
}

const errorBody = (code: string, message: string) => ({ error: { code, message } });

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string>, close = false) {
  const h: Record<string, string> = { ...headers, 'Cache-Control': 'no-store' };
  if (close) h.Connection = 'close';
  if (status === 204 || body === undefined) {
    res.writeHead(status, h).end();
    return;
  }
  const json = JSON.stringify(body);
  res.writeHead(status, { ...h, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(json)) }).end(json);
}

function flattenHeaders(raw: IncomingMessage['headers']): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v.join(', ') : v;
  return out;
}

type BodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };

function readBody(req: Req, max: number): Promise<BodyResult> {
  if (req.body !== undefined) return Promise.resolve({ ok: true, value: req.body });
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > max) return Promise.resolve({ ok: false, status: 413 });
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (r: BodyResult) => {
      if (done) return;
      done = true;
      resolve(r);
    };
    req.on('data', (c: Buffer) => {
      if (done) return;
      size += c.length;
      if (size > max) {
        chunks.length = 0;
        finish({ ok: false, status: 413 });
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (size === 0) return finish({ ok: true, value: undefined });
      try {
        finish({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      } catch {
        finish({ ok: false, status: 400 });
      }
    });
    req.on('error', () => finish({ ok: false, status: 400 }));
  });
}

/** Gắn các route JSON vào app: CORS theo allowedOrigins, giới hạn body, parse JSON. Mọi route khác đi tiếp (next). */
export function mountHttp(app: UseApp, routes: HttpRoute[], cfg: Pick<Config, 'allowedOrigins' | 'httpMaxBodyBytes'>): void {
  const allowed = new Set(cfg.allowedOrigins);
  app.use((req, res, next) => {
    const url = req.originalUrl ?? req.url ?? '/';
    const path = url.split('?')[0]!;
    const route = routes.find((r) => path.startsWith(r.prefix));
    if (!route) return next();

    const origin = req.headers.origin;
    const cors: Record<string, string> = {};
    if (typeof origin === 'string' && allowed.has(origin)) {
      cors['Access-Control-Allow-Origin'] = origin;
      cors.Vary = 'Origin';
    }
    const method = req.method ?? 'GET';
    if (method === 'OPTIONS') {
      if (cors['Access-Control-Allow-Origin']) {
        cors['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
        cors['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
        cors['Access-Control-Max-Age'] = '600';
      }
      return send(res, 204, undefined, cors);
    }

    void (async () => {
      try {
        const body = await readBody(req, cfg.httpMaxBodyBytes);
        if (!body.ok) {
          if (body.status === 413) {
            send(res, 413, errorBody('PAYLOAD_TOO_LARGE', 'Dữ liệu gửi lên quá lớn'), cors, true);
            req.resume();
          } else {
            send(res, 400, errorBody('INVALID', 'Dữ liệu gửi lên không hợp lệ'), cors);
          }
          return;
        }
        const r = await route.handle({ method, path: url, headers: flattenHeaders(req.headers), body: body.value });
        send(res, r.status, r.body, cors);
      } catch {
        if (!res.headersSent) send(res, 500, errorBody('INTERNAL', 'Lỗi hệ thống, vui lòng thử lại sau'), cors);
        else res.end();
      }
    })();
  });
}
