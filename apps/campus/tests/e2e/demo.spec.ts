/** E2E bản chơi thử offline: không cần server, chỉ trang demo.html. */
import { test, expect, type Page } from '@playwright/test';

interface D { map: string; self: { x: number; y: number }; target: unknown; npcs: { name: string; x: number; y: number }[] }
const st = (page: Page): Promise<D | null> => page.evaluate(() => (window as any).__demo?.state() ?? null);

async function open(page: Page, errors: string[], q = '') {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/demo.html${q}`);
  await expect.poll(async () => (await st(page))?.map ?? null, { timeout: 15_000 }).not.toBeNull();
}

test('đi bằng phím trong sân trường', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  const a = (await st(page))!;
  expect(a.map).toBe('campus');
  await page.locator('canvas').click({ position: { x: 640, y: 700 } }); // lấy focus
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowLeft');
  const b = (await st(page))!;
  expect(b.self.x).toBeLessThan(a.self.x - 40);
  expect(b.npcs.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('vào lớp từ menu, đi bằng chạm/bấm, đổi bố cục', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors);
  await page.getByRole('button', { name: /bố cục vui nhộn/ }).click();
  await expect.poll(async () => (await st(page))?.map).toBe('class-playful');
  expect(page.url()).toContain('map=class-playful');
  const a = (await st(page))!;
  await page.evaluate(() => (window as any).__demo.moveTo(640, 450));
  await expect.poll(async () => (await st(page))!.self.y, { timeout: 5_000 }).toBeLessThan(a.self.y - 100);

  await page.getByRole('button', { name: /bố cục truyền thống/ }).click();
  await expect.poll(async () => (await st(page))?.map).toBe('class-traditional');
  // không đi xuyên bàn: nhắm vào giữa một bàn thì dừng trước bàn
  await page.evaluate(() => (window as any).__demo.moveTo(755, 540));
  await expect.poll(async () => (await st(page))!.target, { timeout: 5_000 }).toBeNull();
  const c = (await st(page))!;
  expect(c.self.y).toBeGreaterThanOrEqual(520 + 40 + 14 - 0.5); // mép dưới bàn + bán kính chân

  await page.getByRole('button', { name: /Sân trường/ }).click();
  await expect.poll(async () => (await st(page))?.map).toBe('campus');
  expect(errors).toEqual([]);
});

test('mở thẳng một lớp bằng ?map=', async ({ page }) => {
  const errors: string[] = [];
  await open(page, errors, '?map=class-traditional');
  expect((await st(page))!.map).toBe('class-traditional');
  expect(errors).toEqual([]);
});
