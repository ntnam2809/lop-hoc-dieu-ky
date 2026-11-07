/**
 * SHOTS=<thư mục> npx playwright test — chụp màn hình sau mỗi hoạt động để duyệt hình.
 *
 * Game QA tự động (đặc tả §19 cấp 2): chơi trọn từng bài bằng thao tác thật
 * — chạm, kéo thả, chạm-chọn, phím tắt giáo viên — để bảo đảm mọi hoạt động
 * hoàn thành được (không kẹt), tạm dừng/phát lại chạy, và không có lỗi JS.
 * Bài mới trong content/lessons/ tự động được kiểm tra.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', 'content', 'lessons');
const lessons = readdirSync(root).map((d) => JSON.parse(readFileSync(join(root, d, 'lesson.json'), 'utf8')));

async function center(l: Locator) {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function drag(page: Page, from: Locator, to: Locator) {
  const a = await center(from);
  const b = await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12);
  await page.mouse.up();
  await page.waitForTimeout(550);
}

const completed = (page: Page) =>
  page.waitForFunction(() => (window as any).__player?.isCompleted(), null, { timeout: 60_000 });

for (const pkg of lessons) {
  test(`chơi trọn bài "${pkg.lesson.title}"`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/fonts|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text());
    });

    await page.goto(`/?mute&speed=6#/lesson/${pkg.lesson.id}`);
    await page.locator('[data-action=start]').click();
    await page.locator('[data-action=ready]').click();
    await page.waitForFunction(() => (window as any).__player?.index === 0);

    const acts = pkg.scenarios.flatMap((s: any) => s.activities);
    for (const [i, a] of acts.entries()) {
      await page.waitForFunction((i) => (window as any).__player.index === i && !(window as any).__player.busy, i);
      const ui = page.locator('.stage-ui');
      switch (a.type) {
        case 'explore':
          for (const t of a.targets) await page.locator(`[data-entity="${t}"]`).click({ force: true });
          break;
        case 'object_identification':
        case 'character_identification':
        case 'action_identification':
        case 'word_selection':
        case 'comparison':
        case 'cause_effect': {
          const wrong = a.options.find((o: any) => o.id !== a.correctAnswer);
          const sel = (id: string) =>
            a.presentation === 'scene'
              ? page.locator(`[data-entity="${a.options.find((o: any) => o.id === id).entity}"]`)
              : ui.locator(`[data-option="${id}"]`);
          await sel(wrong.id).first().waitFor();
          await sel(wrong.id).first().click({ force: true }); // sai → được mời thử lại, không bị khoá
          await page.waitForTimeout(300);
          await sel(a.correctAnswer).first().click({ force: true });
          break;
        }
        case 'sequence':
        case 'sentence_builder':
          for (const [k, id] of a.correctOrder.entries()) {
            const card = ui.locator(`.tray [data-card="${id}"]`);
            const slot = ui.locator(`.slot[data-slot="${k}"]`);
            await card.waitFor();
            if (k === 0) {
              // Chế độ chạm-chọn rồi chạm-ô (cho bảng tương tác / chuột).
              await card.click();
              await slot.click({ force: true }); // ô đang nhấp nháy "chờ thả" nên không bao giờ đứng yên
              await page.waitForTimeout(550);
            } else await drag(page, card, slot);
          }
          break;
        case 'story_recall':
          for (const f of a.frames) {
            await ui.locator(`.film-strip [data-card="${f.id}"]`).click();
            await page.waitForTimeout(200);
          }
          break;
        case 'prediction':
          await ui.locator(`[data-option="${a.options[0].id}"]`).click();
          break;
        case 'classification':
          for (const it of a.items) {
            const card = ui.locator(`.sort-tray [data-card="${it.id}"]`);
            await card.waitFor();
            await drag(page, card, ui.locator(`.bin[data-bin="${it.category}"]`));
          }
          break;
      }
      await completed(page);
      if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `${pkg.lesson.id}-${String(i).padStart(2, '0')}.png`) });

      if (i === 0) {
        // Tạm dừng / tiếp tục / phát lại bằng phím tắt của giáo viên.
        await page.keyboard.press(' ');
        await expect(page.locator('.page-play')).toHaveClass(/paused/);
        await page.keyboard.press(' ');
        await expect(page.locator('.page-play')).not.toHaveClass(/paused/);
      }
      await page.keyboard.press('ArrowRight');
    }

    await expect(page.locator('.page-summary')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.checklist li.done')).toHaveCount(pkg.lesson.learningObjectives.length);
    if (process.env.SHOTS) {
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(process.env.SHOTS, `${pkg.lesson.id}-summary.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test('trang chủ → khu vực → bài học hiển thị đủ thông tin cho giáo viên', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.domain-card')).toHaveCount(2);
  await page.locator('[data-domain=science]').click();
  await page.locator('.lesson-card').first().click();
  await expect(page.locator('.brief-panel')).toHaveCount(4);
  await expect(page.locator('.flow-item')).not.toHaveCount(0);
});
