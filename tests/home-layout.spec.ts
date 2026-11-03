// Home page layout (option 1): "Who we are" and "What we do" share the top of the page;
// the SDG panel and the "Why Pharos?" block are gone from Home (they live on About).
// "Who we are" uses the lead type size, and the edition section carries the soup
// kitchen partner card under an "Inaugural Edition partner" label.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

  test('"Who we are" paragraph uses the lead size, not the old body-lg size', async ({ page }) => {
    await page.goto('/');
    const text = page.locator('.who__text');
    await expect(text).toHaveClass(/t-lead/);
    await expect(text).not.toHaveClass(/t-body-lg/);
    // tokens.json: lead is 19px on phones and 23px on desktop (body-lg was 17px and 20px).
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(text).toHaveCSS('font-size', '19px');
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(text).toHaveCSS('font-size', '23px');
  });

  test('"Who we are" paragraph fills the width between the gutters on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const { textWidth, available } = await page.evaluate(() => {
      const who = document.querySelector('.who') as HTMLElement;
      const cs = getComputedStyle(who);
      return {
        textWidth: (document.querySelector('.who__text') as HTMLElement).getBoundingClientRect().width,
        available: who.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      };
    });
    expect(textWidth).toBeGreaterThan(300); // it used to be capped at 300px
    expect(Math.abs(textWidth - available)).toBeLessThanOrEqual(1);
  });

  test('"Who we are" paragraph keeps a comfortable line length on desktop (60 to 70 characters)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const perLine = await page.evaluate(() => {
      const el = document.querySelector('.who__text') as HTMLElement;
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      return (el.textContent ?? '').trim().replace(/\s+/g, ' ').length / lines;
    });
    expect(perLine).toBeGreaterThanOrEqual(55);
    expect(perLine).toBeLessThanOrEqual(75);
  });

  test('the edition section shows the partner card under an "Inaugural Edition partner" label', async ({ page }) => {
    await page.goto('/');
    const edition = page.locator('section.edition');
    const label = edition.getByText('Inaugural Edition partner', { exact: true });
    await expect(label).toBeVisible();
    await expect(label).toHaveClass(/t-label/);
    const card = edition.locator('.sk');
    await expect(card).toBeVisible();
    await expect(card).toContainText('A fundraiser for The Assembly Soup Kitchen (T.A.S.K)');
    await expect(card.getByRole('link', { name: /^Facebook/ })).toHaveAttribute('href', 'https://www.facebook.com/theassemblysoupkitchen/');
    await expect(card.getByRole('link', { name: /^Instagram/ })).toHaveAttribute('href', 'https://www.instagram.com/assemblysoupkitchen/');
    for (const name of ['Facebook', 'Instagram']) {
      const link = card.getByRole('link', { name: new RegExp(`^${name}`) });
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
    // The label sits directly above the card, and the logo is the agreed file, unstretched.
    const l = (await label.boundingBox())!;
    const c = (await card.boundingBox())!;
    expect(l.y + l.height).toBeLessThanOrEqual(c.y + 1);
    expect(c.y - (l.y + l.height)).toBeLessThan(40);
    const img = card.getByAltText('The Assembly Soup Kitchen (T.A.S.K) logo');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(600);
    const box = (await img.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(600 / 516, 1);
  });

  test('the partner logo appears once on Home, and not in the header or footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('img[src*="task-logo"]')).toHaveCount(1);
    await expect(page.locator('header img[src*="task-logo"], footer img[src*="task-logo"], nav img[src*="task-logo"]')).toHaveCount(0);
  });

  test('the edition section comes after Who we are and What we do', async ({ page }) => {
    await page.goto('/');
    const y = async (sel: string) => (await page.locator(sel).boundingBox())!.y;
    expect(await y('section.who')).toBeLessThan(await y('section.doings'));
    expect(await y('section.doings')).toBeLessThan(await y('section.edition'));
  });

  for (const width of [360, 768, 1440]) {
    test(`no sideways scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test('no accessibility problems in Who we are and the edition section', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).include('.who').include('.edition').analyze();
    expect(results.violations).toEqual([]);
  });
});
