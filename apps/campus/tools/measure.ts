// Công cụ đo spike S1 (fps, bundle, rò bộ nhớ, độ trễ, tài nguyên server).
// Chạy: npm run build -w @lhdk/campus && npm run measure -w @lhdk/campus
// Cờ/ENV: --server-port / MEASURE_SERVER_PORT (2577) · --stress-port / MEASURE_STRESS_PORT (2578)
//         --preview-port / MEASURE_PREVIEW_PORT (5197) · --out-dir / MEASURE_OUT_DIR
//         --only fps,bundle,leak,latency,server,throttle (mặc định: tất cả) · --rounds N (vòng rò bộ nhớ, mặc định 10) · PW_CHROMIUM
// Kết quả JSON in ra stdout và ghi vào <out-dir>/measure-out-<n>.json (không ghi vào repo).
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium, type Browser, type Page } from '@playwright/test';
import { Client } from '@colyseus/sdk';

const HERE = dirname(fileURLToPath(import.meta.url));
const CAMPUS = resolve(HERE, '..');
const ROOT = resolve(CAMPUS, '..', '..');

function arg(name: string, env: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  return process.env[env] || def;
}
const SERVER_PORT = Number(arg('server-port', 'MEASURE_SERVER_PORT', '2577'));
const STRESS_PORT = Number(arg('stress-port', 'MEASURE_STRESS_PORT', '2578'));
const PREVIEW_PORT = Number(arg('preview-port', 'MEASURE_PREVIEW_PORT', '5197'));
const OUT_DIR = arg('out-dir', 'MEASURE_OUT_DIR', join(tmpdir(), 'lhdk-measure'));
const ONLY = new Set(arg('only', 'MEASURE_ONLY', 'fps,bundle,leak,latency,server,throttle').split(','));
const CHROMIUM = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
const WARMUP_MS = 5000;
const SAMPLE_MS = 20_000;
const LEAK_ROUNDS = Number(arg('rounds', 'MEASURE_ROUNDS', '10'));
const LEAK_WARMUP_ROUNDS = 5; // bỏ khỏi hồi quy
const LATENCY_SAMPLES = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const log = (...a: unknown[]) => console.error('[measure]', ...a);

// ---------- tiến trình con ----------
const children: ChildProcess[] = [];
let correctCount = 0; // số dòng '[campus] correct <lý do>' của server đo (CAMPUS_LOG_CORRECT=1)
const correctReasons: Record<string, number> = {};
function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): ChildProcess {
  const p = spawn(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...opts.env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (opts.env?.CAMPUS_LOG_CORRECT) {
    p.stdout?.on('data', (d: Buffer) => {
      for (const line of d.toString().split('\n')) {
        const m = /\[campus\] correct (\S+)/.exec(line);
        if (m) { correctCount++; correctReasons[m[1]!] = (correctReasons[m[1]!] ?? 0) + 1; }
      }
    });
  }
  p.stdout?.resume();
  p.stderr?.resume();
  children.push(p);
  return p;
}
function killTree(p: ChildProcess, sig: NodeJS.Signals = 'SIGTERM') {
  if (p.pid && p.exitCode === null) {
    try { process.kill(-p.pid, sig); } catch { /* đã thoát */ }
  }
}
async function stop(p: ChildProcess) {
  killTree(p);
  for (let i = 0; i < 40 && p.exitCode === null && p.signalCode === null; i++) await sleep(100);
  killTree(p, 'SIGKILL');
}
function cleanup() { children.forEach((c) => killTree(c, 'SIGKILL')); }
process.on('exit', cleanup);
for (const s of ['SIGINT', 'SIGTERM'] as const) process.on(s, () => { cleanup(); process.exit(130); });

async function healthOk(port: number): Promise<boolean> {
  try {
    const r = await fetch(`http://localhost:${port}/health`);
    return r.status === 200;
  } catch { return false; }
}
async function waitHealth(port: number, timeoutMs = 90_000): Promise<number> {
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    if (await healthOk(port)) return performance.now() - t0;
    await sleep(20);
  }
  throw new Error(`server :${port} không lên /health trong ${timeoutMs} ms`);
}

// ---------- /proc ----------
const CLK_TCK = Number(execFileSync('getconf', ['CLK_TCK']).toString().trim()) || 100;
/** Tiến trình node lá (chạy src/index.ts với loader tsx) có PORT=<port>. */
function findServerPid(port: number): number {
  let best = 0;
  for (const d of readdirSync('/proc')) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const cmd = readFileSync(`/proc/${d}/cmdline`, 'utf8');
      if (!cmd.includes('src/index.ts') || !cmd.includes('loader.mjs')) continue;
      const env = readFileSync(`/proc/${d}/environ`, 'utf8').split('\0');
      if (env.includes(`PORT=${port}`)) best = Math.max(best, Number(d));
    } catch { /* tiến trình vừa thoát / không đọc được */ }
  }
  if (!best) throw new Error(`không tìm thấy pid server :${port}`);
  return best;
}
function rssMb(pid: number): number {
  const m = /VmRSS:\s+(\d+) kB/.exec(readFileSync(`/proc/${pid}/status`, 'utf8'));
  return round(Number(m?.[1] ?? 0) / 1024, 1);
}
function cpuTicks(pid: number): number {
  const s = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const f = s.slice(s.lastIndexOf(')') + 2).split(' '); // f[0] = trạng thái (field 3)
  return Number(f[11]) + Number(f[12]); // utime (14) + stime (15)
}
async function serverUsage(pid: number, windowMs = 10_000) {
  const t0 = performance.now();
  const c0 = cpuTicks(pid);
  await sleep(windowMs);
  const c1 = cpuTicks(pid);
  const dt = (performance.now() - t0) / 1000;
  const psPcpu = Number(execFileSync('ps', ['-o', 'pcpu=', '-p', String(pid)]).toString().trim());
  return {
    rss_mb: rssMb(pid),
    cpu_pct_window: round(((c1 - c0) / CLK_TCK / dt) * 100, 1),
    window_s: round(dt, 1),
    ps_pcpu_lifetime: psPcpu,
  };
}

// ---------- thống kê ----------
function pct(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[i]!;
}
function slope(ys: number[]): number {
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  ys.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  return num / den;
}

// ---------- server / preview / bots ----------
function startServer(port: number, maxClients?: number): ChildProcess {
  const env: NodeJS.ProcessEnv = { PORT: String(port), CAMPUS_LOG_CORRECT: '1' };
  if (maxClients) env.CAMPUS_MAX_CLIENTS = String(maxClients);
  return run('npm', ['run', 'start', '-w', '@lhdk/server'], { env });
}
async function startBots(n: number, port: number, seconds: number): Promise<ChildProcess> {
  const p = run('npm', ['run', 'bots', '-w', '@lhdk/server', '--', '--n', String(n), '--url', `ws://localhost:${port}`, '--seconds', String(seconds)]);
  let out = '';
  p.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
  const t0 = Date.now();
  while (!/đã vào/.test(out)) {
    if (p.exitCode !== null) throw new Error(`bots thoát sớm: ${out}`);
    if (Date.now() - t0 > 60_000) throw new Error(`bots không vào đủ trong 60 s: ${out}`);
    await sleep(100);
  }
  const bad = /bot lỗi/.test(out);
  if (bad) throw new Error(`bot lỗi khi vào: ${out}`);
  return p;
}

// ---------- trình duyệt ----------
async function launch(): Promise<Browser> {
  return chromium.launch({
    executablePath: CHROMIUM,
    args: ['--use-gl=swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'],
  });
}
const url = (extra: string) => `http://localhost:${PREVIEW_PORT}/?${extra}`;
async function newPage(b: Browser): Promise<Page> {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  // tsx (esbuild keepNames) chèn __name vào hàm evaluate; trang không có nên định nghĩa giả.
  await ctx.addInitScript('window.__name = (f) => f;');
  return ctx.newPage();
}
async function waitPlayers(page: Page, target: number, timeoutMs = 30_000): Promise<number> {
  const t0 = Date.now();
  let n = -1;
  while (Date.now() - t0 < timeoutMs) {
    n = await page.evaluate(() => {
      const s = window.__campus.state();
      return s.connected ? s.players.length : -1;
    });
    if (n === target) return n;
    await sleep(200);
  }
  return n;
}

// ---------- a. fps ----------
async function fpsScenario(b: Browser, label: string, port: number, avatars: number) {
  log('fps', label);
  const page = await newPage(b);
  try {
    await page.goto(url(`name=Viewer&server=ws://localhost:${port}`));
    const got = await waitPlayers(page, avatars);
    if (got !== avatars) throw new Error(`${label}: viewer thấy ${got} avatar, cần ${avatars}; không đo`);
    await sleep(WARMUP_MS);
    const dts: number[] = await page.evaluate(
      (ms) => new Promise<number[]>((resolveP) => {
        const out: number[] = [];
        let last = performance.now();
        const t0 = last;
        const tick = (now: number) => {
          out.push(now - last);
          last = now;
          if (now - t0 < ms) requestAnimationFrame(tick);
          else resolveP(out);
        };
        requestAnimationFrame(tick);
      }),
      SAMPLE_MS,
    );
    const after = await page.evaluate(() => {
      const s = window.__campus.state();
      return { players: s.players.length, gameFps: s.fps, rtt: s.rtt };
    });
    dts.shift(); // khung đầu có thể dài bất thường do khởi động bộ đếm
    const total = dts.reduce((a, c) => a + c, 0);
    const inst = dts.map((d) => 1000 / d).sort((a, c) => a - c);
    return {
      avatars,
      players_before: got,
      players_after: after.players,
      frames: dts.length,
      fps_mean: round((dts.length / total) * 1000, 1),
      fps_p5: round(pct(inst, 5), 1),
      fps_p1: round(pct(inst, 1), 1),
      frame_ms_p99: round(pct([...dts].sort((a, c) => a - c), 99), 1),
      frame_ms_max: round(Math.max(...dts), 1),
      game_loop_fps_end: after.gameFps,
      rtt_ms_end: after.rtt,
    };
  } finally {
    // Rời phòng có chủ đích: đóng tab thẳng sẽ để server giữ chỗ reconnect 30 s (ghost) và làm lệch phép đếm.
    await page.evaluate(() => window.__campus.unmount()).catch(() => {});
    await sleep(800);
    await page.context().close();
  }
}

// ---------- b. bundle ----------
function bundle() {
  const dist = join(CAMPUS, 'dist');
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|css)$/.test(e.name) || (e.name === 'index.html' && d === dist)) files.push(p);
    }
  };
  walk(dist);
  const rows = files.map((f) => {
    const buf = readFileSync(f);
    return { file: f.slice(dist.length + 1), raw_bytes: buf.length, gzip_bytes: gzipSync(buf, { level: 9 }).length };
  });
  const raw = rows.reduce((a, r) => a + r.raw_bytes, 0);
  const gz = rows.reduce((a, r) => a + r.gzip_bytes, 0);
  return {
    files: rows,
    raw_total_bytes: raw,
    gzip_total_bytes: gz,
    gzip_total_kib: round(gz / 1024, 1),
    limit_bytes: 1_500_000,
    within_limit: gz <= 1_500_000,
  };
}

// ---------- c. rò bộ nhớ ----------
async function leak(b: Browser) {
  log('leak');
  const observerRoom = await new Client(`ws://localhost:${SERVER_PORT}`).joinOrCreate('campus', { name: 'Observer' });
  await new Promise<void>((r) => observerRoom.onStateChange.once(() => r()));
  const count = () => (observerRoom.state as any).players.size as number;
  const page = await newPage(b);
  try {
    const cdp = await page.context().newCDPSession(page);
    await page.goto(url(`harness=1&name=Leak&server=ws://localhost:${SERVER_PORT}`));
    const heap = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      await cdp.send('HeapProfiler.collectGarbage');
      await sleep(200);
      return (await cdp.send('Runtime.getHeapUsage')).usedSize;
    };
    const dom = () => page.evaluate(() => ({
      nodes: document.getElementsByTagName('*').length,
      canvases: document.getElementsByTagName('canvas').length,
    }));
    const listeners = async () => {
      try {
        const w = await cdp.send('Runtime.evaluate', { expression: 'window' });
        const l = await cdp.send('DOMDebugger.getEventListeners', { objectId: w.result.objectId! });
        return l.listeners.length;
      } catch { return -1; }
    };
    const baseHeap = await heap();
    const baseListeners = await listeners();
    const baseDom = await dom();
    const observerBase = count();
    const rounds: Array<Record<string, number>> = [];
    for (let i = 1; i <= LEAK_ROUNDS; i++) {
      await page.evaluate(() => window.__campus.mount());
      await sleep(2000);
      const whileMounted = count() - 1; // trừ chính observer
      await page.evaluate(() => window.__campus.unmount());
      const t0 = Date.now();
      while (count() > observerBase && Date.now() - t0 < 5000) await sleep(50);
      const closeMs = Date.now() - t0;
      const serverPlayers = count() - 1;
      const used = await heap();
      const d = await dom();
      const wl = await listeners();
      rounds.push({ round: i, usedSize: used, domNodes: d.nodes, canvases: d.canvases, windowListeners: wl, serverPlayersWhileMounted: whileMounted, serverPlayersAfterUnmount: serverPlayers, closeMs });
    }
    const ys = [baseHeap, ...rounds.map((r) => r.usedSize!)];
    const last = ys[ys.length - 1]!;
    const tail = rounds.slice(LEAK_WARMUP_ROUNDS).map((r) => r.usedSize!);
    return {
      base: { usedSize: baseHeap, domNodes: baseDom.nodes, canvases: baseDom.canvases, observerCountBaseline: observerBase },
      rounds,
      delta_bytes: last - baseHeap,
      delta_pct: round(((last - baseHeap) / baseHeap) * 100, 2),
      slope_bytes_per_round: Math.round(slope(ys)),
      rounds_total: LEAK_ROUNDS,
      warmup_rounds_dropped: LEAK_WARMUP_ROUNDS,
      slope_after_warmup_bytes_per_round: tail.length >= 2 ? Math.round(slope(tail)) : null,
      base_window_listeners: baseListeners,
      server_players_after_all_unmounts: rounds.map((r) => r.serverPlayersAfterUnmount),
      final_dom_nodes_delta: rounds[rounds.length - 1]!.domNodes! - baseDom.nodes,
      final_canvases: rounds[rounds.length - 1]!.canvases,
      note: 'serverPlayers = số player observer thấy trừ chính observer',
    };
  } finally {
    await page.context().close();
    await observerRoom.leave();
  }
}

// ---------- d. độ trễ ----------
async function latency(b: Browser) {
  log('latency');
  const pa = await newPage(b);
  const pb = await newPage(b);
  try {
    await pa.goto(url(`name=A&server=ws://localhost:${SERVER_PORT}`));
    await pb.goto(url(`name=B&server=ws://localhost:${SERVER_PORT}`));
    if ((await waitPlayers(pa, 2)) !== 2 || (await waitPlayers(pb, 2)) !== 2) throw new Error('latency: hai tab chưa thấy nhau');
    const idA = await pa.evaluate(() => window.__campus.state().self!.id);
    const settle = async (x: number, y: number) => {
      for (let i = 0; i < 100; i++) {
        const near = await pa.evaluate(([tx, ty]) => {
          const s = window.__campus.state().self!;
          return Math.hypot(s.x - tx!, s.y - ty!) < 3;
        }, [x, y]);
        if (near) break;
        await sleep(100);
      }
      await sleep(400);
    };
    await pa.evaluate(() => window.__campus.moveTo(300, 360));
    await settle(300, 360);
    const samples: number[] = [];
    for (let i = 0; i < LATENCY_SAMPLES; i++) {
      const tx = i % 2 === 0 ? 900 : 300;
      // Gài bộ chờ ở B: ghi Date.now() khi vị trí A trong state của B lệch > 2 px so với lúc gài.
      await pb.evaluate((id) => {
        const find = () => window.__campus.state().players.find((p) => p.id === id);
        const p0 = find()!;
        (window as any).__w = new Promise<number>((resolveP) => {
          const poll = () => {
            const p = find();
            if (p && Math.hypot(p.x - p0.x, p.y - p0.y) > 2) resolveP(Date.now());
            else setTimeout(poll, 0);
          };
          poll();
        });
      }, idA);
      const t0 = await pa.evaluate((x) => { const t = Date.now(); window.__campus.moveTo(x, 360); return t; }, tx);
      const t1 = await Promise.race([
        pb.evaluate(() => (window as any).__w as Promise<number>),
        sleep(5000).then(() => { throw new Error('latency: quá 5 s không thấy A di chuyển'); }),
      ]);
      samples.push(t1 - t0);
      await settle(tx, 360);
    }
    const s = [...samples].sort((a, c) => a - c);
    return {
      n: samples.length,
      median_ms: pct(s, 50),
      p95_ms: pct(s, 95),
      median_minus_interp_ms: pct(s, 50) - 100,
      p95_minus_interp_ms: pct(s, 95) - 100,
      interp_delay_ms_assumed: 100,
      min_ms: s[0],
      max_ms: s[s.length - 1],
      mean_ms: round(samples.reduce((a, c) => a + c, 0) / samples.length, 1),
      definition: 'moveTo(A) -> state() của B thấy vị trí A lệch > 2 px; Date.now() cùng máy; polling setTimeout(0)',
    };
  } finally {
    await pa.evaluate(() => window.__campus.unmount()).catch(() => {});
    await pb.evaluate(() => window.__campus.unmount()).catch(() => {});
    await sleep(500);
    await pa.context().close();
    await pb.context().close();
  }
}

// ---------- e. tốc độ client dưới tải CPU ----------
async function throttle(b: Browser) {
  log('throttle');
  const page = await newPage(b);
  const levels: Array<Record<string, unknown>> = [];
  try {
    const cdp = await page.context().newCDPSession(page);
    await page.goto(url(`name=Thr&server=ws://localhost:${SERVER_PORT}`));
    if ((await waitPlayers(page, 1)) !== 1) throw new Error('throttle: chưa vào phòng');
    const goAndMeasure = async (x: number, y: number) => page.evaluate(([tx, ty]) => new Promise<{ px_per_s: number; dist: number; ms: number; arrived: boolean }>((res) => {
      const s0 = window.__campus.state().self!;
      const p0 = { x: s0.x, y: s0.y };
      const t0 = performance.now();
      window.__campus.moveTo(tx!, ty!);
      const tick = () => {
        const s = window.__campus.state().self!;
        const ms = performance.now() - t0;
        const arrived = Math.hypot(s.x - tx!, s.y - ty!) < 3;
        if (arrived || ms > 90_000) {
          const dist = Math.hypot(s.x - p0.x, s.y - p0.y);
          res({ px_per_s: dist / (ms / 1000), dist, ms, arrived });
        } else setTimeout(tick, 20);
      };
      tick();
    }), [x, y]);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await goAndMeasure(150, 360);
    let x = 750; // luân phiên 150 ↔ 750 (600 px), liên tục xuyên các mức để mẫu nào cũng đi đủ 600 px
    for (const rate of [1, 4, 12]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await sleep(500);
      const c0 = correctCount;
      const r0 = { ...correctReasons };
      const samples: Array<{ px_per_s: number; dist: number; ms: number; arrived: boolean }> = [];
      for (let i = 0; i < 3; i++) {
        samples.push(await goAndMeasure(x, 360));
        x = x === 750 ? 150 : 750;
      }
      await sleep(500);
      const reasons: Record<string, number> = {};
      for (const [k, v] of Object.entries(correctReasons)) if (v - (r0[k] ?? 0) > 0) reasons[k] = v - (r0[k] ?? 0);
      const speeds = samples.map((s) => round(s.px_per_s, 1));
      levels.push({ cpu_throttle: rate, px_per_s: speeds, mean_px_per_s: round(speeds.reduce((a, c) => a + c, 0) / speeds.length, 1), dist_px: samples.map((s) => round(s.dist, 0)), arrived: samples.map((s) => s.arrived), correct_lines: correctCount - c0, correct_reasons: reasons });
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    return { client_speed_px_s: 200, server_cap_px_s: 220, levels };
  } finally {
    await page.evaluate(() => window.__campus.unmount()).catch(() => {});
    await sleep(500);
    await page.context().close();
  }
}

// ---------- main ----------
async function main() {
  const result: Record<string, unknown> = {
    started_at: new Date().toISOString(),
    node: process.version,
    cpus: execFileSync('nproc').toString().trim(),
    config: { SERVER_PORT, STRESS_PORT, PREVIEW_PORT, viewport: '1024x768 DPR1', warmup_ms: WARMUP_MS, sample_ms: SAMPLE_MS },
  };
  if (!existsSync(join(CAMPUS, 'dist', 'index.html'))) {
    log('chưa có dist, chạy vite build');
    execFileSync('npx', ['vite', 'build'], { cwd: CAMPUS, stdio: 'ignore' });
  }
  if (ONLY.has('bundle')) result.bundle = bundle();

  if (await healthOk(SERVER_PORT)) throw new Error(`cổng ${SERVER_PORT} đã có server khác; đổi --server-port`);

  // e1. khởi động lạnh: qua npx tsx rồi qua npm run start
  const cold: Record<string, number> = {};
  if (ONLY.has('server')) {
    log('cold start');
    const p = run('npx', ['tsx', 'src/index.ts'], { cwd: join(ROOT, 'apps', 'server'), env: { PORT: String(SERVER_PORT) } });
    cold.npx_tsx_ms = Math.round(await waitHealth(SERVER_PORT));
    await stop(p);
    await sleep(500);
  }
  const server = startServer(SERVER_PORT);
  const tStart = performance.now();
  const npmMs = Math.round(await waitHealth(SERVER_PORT));
  void tStart;
  cold.npm_run_start_ms = npmMs;
  await sleep(1500);
  const pid = findServerPid(SERVER_PORT);
  if (ONLY.has('server')) result.cold_start = cold;

  const needBrowser = ['fps', 'leak', 'latency', 'throttle'].some((k) => ONLY.has(k));
  const preview = needBrowser ? run('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], { cwd: CAMPUS }) : null;
  const res: Record<string, unknown> = {};
  const serverRes: Record<string, unknown> = {};
  try {
    if (preview) {
      const t0 = Date.now();
      while (Date.now() - t0 < 30_000) {
        try { if ((await fetch(`http://localhost:${PREVIEW_PORT}/`)).ok) break; } catch { /* chưa lên */ }
        await sleep(200);
      }
    }
    if (ONLY.has('server')) {
      await sleep(3000);
      serverRes.idle_0_clients = await serverUsage(pid);
    }
    const b = needBrowser ? await launch() : null;
    try {
      if (b) result.chromium = b.version();
      if (b && ONLY.has('fps')) {
        const fps: Record<string, unknown> = {};
        fps.bots0_1avatar = await fpsScenario(b, '0 bot', SERVER_PORT, 1);
        // 19 bot + viewer = 20 avatar
        let bots = await startBots(19, SERVER_PORT, 120);
        try {
          if (ONLY.has('server')) {
            await sleep(3000);
            serverRes.with_19_bots = await serverUsage(pid);
          }
          fps.avatars20 = await fpsScenario(b, '20 avatar', SERVER_PORT, 20);
        } finally { await stop(bots); }
        await sleep(2000);
        if (ONLY.has('server')) serverRes.idle_after_bots = await serverUsage(pid);
        // 29 bot + viewer = 30 avatar, server riêng trần 30 (vượt trần sản phẩm 20)
        const stress = startServer(STRESS_PORT, 30);
        try {
          await waitHealth(STRESS_PORT);
          bots = await startBots(29, STRESS_PORT, 120);
          try {
            fps.avatars30_over_cap = await fpsScenario(b, '30 avatar', STRESS_PORT, 30);
          } finally { await stop(bots); }
        } finally { await stop(stress); }
        const m = (k: string) => (fps[k] as { fps_mean: number }).fps_mean;
        fps.ratio_fps20_over_fps1 = round(m('avatars20') / m('bots0_1avatar'), 3);
        fps.ratio_fps30_over_fps1 = round(m('avatars30_over_cap') / m('bots0_1avatar'), 3);
        res.fps = fps;
      } else if (ONLY.has('server')) {
        const bots = await startBots(19, SERVER_PORT, 60);
        try { await sleep(3000); serverRes.with_19_bots = await serverUsage(pid); } finally { await stop(bots); }
        await sleep(2000);
        serverRes.idle_after_bots = await serverUsage(pid);
      }
      if (b && ONLY.has('leak')) res.leak = await leak(b);
      if (b && ONLY.has('latency')) res.latency = await latency(b);
      if (b && ONLY.has('throttle')) res.throttle = await throttle(b);
    } finally {
      await b?.close();
    }
  } finally {
    if (preview) await stop(preview);
    await stop(server);
  }
  Object.assign(result, res);
  if (ONLY.has('server')) result.server = serverRes;
  result.finished_at = new Date().toISOString();

  mkdirSync(OUT_DIR, { recursive: true });
  let n = 1;
  while (existsSync(join(OUT_DIR, `measure-out-${n}.json`))) n++;
  const out = join(OUT_DIR, `measure-out-${n}.json`);
  writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result));
  log('đã ghi', out);
}

main().then(() => process.exit(0), (e) => {
  console.error('[measure] LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
