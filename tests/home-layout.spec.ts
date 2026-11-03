// Home page layout (option 2): "What we do" comes first in the page body, then the
// "Who we are" + SDG row, then "Why Pharos?", then the edition and the waitlist.
// Every section is still there.
import { test, expect } from '@playwright/test';

test.describe('Home layout (sections and order)', () => {
  test('shows every section, in the right order', async ({ page }) => {
    await page.goto('/');
    const headings = (await page.locator('main h2').allInnerTexts()).map((t) => t.trim());
    expect(headings).toEqual([
      'What we do',
      'Who we are',
      'Built on the Sustainable Development Goals',
      'A light for strangers.',
      'Your essay can feed someone.',
      'Get told when entries open',
    ]);
  });

  test('"What we do" is the first thing in the page body, with its three cards', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('main > :first-child');
    await expect(first).toHaveClass(/doings/);
    await expect(first.locator('.doing')).toHaveCount(3);
    await expect(first.getByRole('link', { name: 'See the competition' })).toHaveAttribute('href', '/competition/');
    await expect(first.getByRole('link', { name: 'Read the blog' })).toHaveAttribute('href', '/blog/');
    await expect(first.getByRole('link', { name: /Find out on Instagram/ })).toBeVisible();
  });

  test('"Who we are" keeps its text and the About us button, next to the SDG panel', async ({ page }) => {
    await page.goto('/');
    const who = page.locator('section.who');
    await expect(who).toContainText("We're student volunteers who think young people should have a say");
    await expect(who.getByRole('link', { name: 'About us' })).toHaveAttribute('href', '/about/');
    await expect(page.locator('section.sdgs')).toContainText('Goals we focus on');
  });

  test('the "Why Pharos?" block is still there', async ({ page }) => {
    await page.goto('/');
    const why = page.locator('section.why');
    await expect(why).toContainText('Why Pharos?');
    await expect(why.getByRole('img')).toBeVisible();
  });

  for (const [label, width, height] of [['desktop', 1440, 900], ['phone', 375, 812]] as const) {
    test(`${label}: sections run top to bottom without overlapping`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const ys: { top: number; bottom: number }[] = [];
      for (const sel of ['section.doings', '.intro-row', 'section.why', 'section.edition']) {
        const box = (await page.locator(sel).boundingBox())!;
        ys.push({ top: box.y, bottom: box.y + box.height });
      }
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i].top).toBeGreaterThanOrEqual(ys[i - 1].bottom - 1);
      }
    });
  }

  test('no doubled gaps between the new neighbours (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const doings = (await page.locator('section.doings').boundingBox())!;
    const row = (await page.locator('.intro-row').boundingBox())!;
    expect(row.y - (doings.y + doings.height)).toBeLessThanOrEqual(64);
    const why = (await page.locator('section.why').boundingBox())!;
    const edition = (await page.locator('section.edition').boundingBox())!;
    expect(edition.y - (why.y + why.height)).toBeLessThanOrEqual(1);
  });

  test('phone: no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
