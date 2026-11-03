// The Key dates timeline on the Competition page (/competition/#dates) and the FAQ link to it.
// Dates are read from DATES in src/site.ts through tests/dates.mjs, never typed here.
import { test, expect } from '@playwright/test';
import { ENTRIES_OPEN_DAY, DEADLINE_DAY, RESULTS_DAY } from './dates.mjs';

const phone = { width: 320, height: 800 };
const desktop = { width: 1440, height: 900 };

test.describe('Key dates', () => {
  test('shows four stops in order with the right dates', async ({ page }) => {
    await page.goto('/competition/');
    const section = page.locator('section#dates');
    await expect(section.getByRole('heading', { level: 2, name: 'Key dates' })).toBeVisible();
    await expect(section).toHaveAttribute('aria-labelledby', 'dates-title');

    const stops = section.locator('ol > li');
    await expect(stops).toHaveCount(4);
    await expect(stops.locator('h3')).toHaveText(['Entries open', 'Deadline', 'Judging', 'Results']);
    await expect(stops.nth(0).locator('.stop__when')).toHaveText(ENTRIES_OPEN_DAY);
    await expect(stops.nth(1).locator('.stop__when')).toHaveText(`${DEADLINE_DAY}, 15:59 UTC`);
    await expect(stops.nth(2).locator('.stop__when')).toHaveText('Late January');
    await expect(stops.nth(3).locator('.stop__when')).toHaveText(RESULTS_DAY);
    await expect(stops.nth(3)).toContainText('On pharosprize.org and Instagram. Winners are also emailed.');
  });

  test('sits between the facts grid and Two categories', async ({ page }) => {
    await page.goto('/competition/');
    const ids = await page.locator('main > section').evaluateAll((els) => els.map((el) => el.className));
    expect(ids.slice(0, 3)).toEqual(['facts', 'dates', 'cats']);
  });

  test('is a vertical list on phones and a horizontal row on desktop', async ({ page }) => {
    await page.setViewportSize(phone);
    await page.goto('/competition/');
    const stops = page.locator('section#dates ol > li');
    const a = await stops.nth(0).boundingBox();
    const b = await stops.nth(1).boundingBox();
    expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);

    await page.setViewportSize(desktop);
    const c = await stops.nth(0).boundingBox();
    const d = await stops.nth(1).boundingBox();
    expect(d!.x).toBeGreaterThan(c!.x + 100);
    expect(Math.abs(d!.y - c!.y)).toBeLessThan(2);
  });

  for (const width of [320, 390, 768, 1440]) {
    test(`no sideways scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/competition/#dates');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('the FAQ opening/closing answer links to #dates', async ({ page }) => {
    await page.goto('/faq/#open-and-close'); // opens the row
    const link = page.locator('div#open-and-close').getByRole('link', { name: 'See all key dates' });
    await expect(link).toHaveAttribute('href', '/competition/#dates');
    await link.click();
    await expect(page).toHaveURL(/\/competition\/#dates$/);
    await expect(page.locator('section#dates')).toBeInViewport();
  });
});
