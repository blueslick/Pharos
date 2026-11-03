// Home page layout (option 1): "Who we are" and "What we do" share the top of the page;
// the SDG panel and the "Why Pharos?" block are gone from Home (they live on About).
import { test, expect } from '@playwright/test';

const headingsInMain = (page: import('@playwright/test').Page) =>
  page.locator('main h2').allInnerTexts();

test.describe('Home layout (sections and order)', () => {
  test('shows the right sections in the right order', async ({ page }) => {
    await page.goto('/');
    const headings = (await headingsInMain(page)).map((t) => t.trim());
    expect(headings).toEqual([
      'Who we are',
      'What we do',
      'Your essay can feed someone.',
      'Get told when entries open',
    ]);
  });

  test('"Who we are" keeps its text and the About us button', async ({ page }) => {
    await page.goto('/');
    const who = page.locator('section.who');
    await expect(who.getByRole('heading', { name: 'Who we are' })).toBeVisible();
    await expect(who).toContainText("We're student volunteers who think young people should have a say");
    await expect(who.getByRole('link', { name: 'About us' })).toHaveAttribute('href', '/about/');
  });

  test('"What we do" still has its three cards', async ({ page }) => {
    await page.goto('/');
    const doings = page.locator('section.doings');
    await expect(doings.locator('.doing')).toHaveCount(3);
    await expect(doings.getByRole('link', { name: 'See the competition' })).toHaveAttribute('href', '/competition/');
    await expect(doings.getByRole('link', { name: 'Read the blog' })).toHaveAttribute('href', '/blog/');
    await expect(doings.getByRole('link', { name: /Find out on Instagram/ })).toBeVisible();
  });

  test('the SDG panel and the "Why Pharos?" block are not on Home', async ({ page }) => {
    await page.goto('/');
    const main = page.locator('main');
    await expect(main).not.toContainText('Built on the Sustainable Development Goals');
    await expect(main).not.toContainText('Goals we focus on');
    await expect(main).not.toContainText('Why Pharos?');
    await expect(main).not.toContainText('A light for strangers.');
    await expect(page.locator('.sdgs, .why')).toHaveCount(0);
    await expect(page.locator('img[src="/images/pharos-hero-ship.png"]')).toHaveCount(0);
  });

  test('the About page still has them', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.getByText('Goals we focus on')).toBeVisible();
    await expect(page.getByText('Why Pharos?')).toBeVisible();
  });

  test('desktop: "What we do" sits directly under "Who we are", with no big gap', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const who = (await page.locator('section.who').boundingBox())!;
    const doings = (await page.locator('section.doings').boundingBox())!;
    expect(doings.y).toBeGreaterThanOrEqual(who.y + who.height - 1);
    expect(doings.y - (who.y + who.height)).toBeLessThan(40);
  });

  test('phone: stacked, Who we are first, no sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const who = (await page.locator('section.who').boundingBox())!;
    const doings = (await page.locator('section.doings').boundingBox())!;
    expect(who.y + who.height).toBeLessThanOrEqual(doings.y + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
