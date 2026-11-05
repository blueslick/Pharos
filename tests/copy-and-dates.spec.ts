// Wording and date changes agreed on 5 Nov 2026: the Home/About "who we are" sentence, the Competition SDG
// explainer, "directly to" instead of "straight to", the Contact cards, and the opening date moving to Monday
// 9 November 2026 (the "FOREX rates as of 5 November 2026" lines are the one place that date stays).
import { test, expect } from '@playwright/test';
import { ENTRIES_OPEN, ENTRIES_OPEN_DAY } from './dates.mjs';

const NORMAL = 'http://localhost:4331';
const OPEN = 'http://localhost:4332';
const pages = ['/', '/competition/', '/about/', '/blog/', '/contact/', '/rules/', '/faq/', '/privacy/', '/verify/'];
const FOREX = /[^.]*based on (?:foreign exchange )?\(?(?:FOREX\)? )?rates as of 5 November 2026[^.]*\./g;

const WHO = "We are student volunteers who believe young people should be part of the solution to the world's biggest problems, and that writing about them can create awareness and inspire change.";

test('the opening date is Monday 9 November 2026', () => {
  expect(ENTRIES_OPEN).toBe('9 November 2026');
  expect(ENTRIES_OPEN_DAY).toBe('Monday 9 November 2026');
});

test('Home and the About description use the new "who we are" sentence', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('.who__text')).toContainText(WHO);
  const about = await (await request.get(`${NORMAL}/about/`)).text();
  expect(about).toContain(WHO);
  await page.goto('/about/');
  await expect(page.locator('.about-intro')).toContainText(WHO);
});

test('Competition: the SDG sentence is followed by the explainer and a link to the About section, on both copies', async ({ page }) => {
  await page.goto('/competition/');
  const copies = page.locator('p.top__sdg');
  await expect(copies).toHaveCount(2);
  for (const copy of await copies.all()) {
    await expect(copy).toContainText('This edition is based on Sustainable Development Goal 2 (SDG 2): Zero Hunger. The SDGs are 17 shared global goals for 2030; Goal 2 is to end hunger.');
    await expect(copy.getByRole('link', { name: 'What are the SDGs?', includeHidden: true })).toHaveAttribute('href', '/about/#sdgs');
  }
  await page.goto('/about/#sdgs');
  await expect(page.locator('#sdgs')).toContainText('Sustainable Development Goals (SDGs)');
});

test('Contact: both cards are plain rounded rectangles with the radius-card token', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/contact/');
    const radius = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--radius-card').trim());
    for (const sel of ['.way--email', '.way--insta']) {
      for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
        await expect(page.locator(sel)).toHaveCSS(`border-${corner}-radius`, radius);
      }
      const r = (await page.locator(sel).boundingBox())!;
      expect(r.x).toBeGreaterThan(0);
      expect(r.x + r.width).toBeLessThan(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test.describe('built pages', () => {
  for (const base of [NORMAL, OPEN]) {
    for (const path of [...pages, '/register/']) {
      test(`${base === OPEN ? 'entries-open build' : 'normal build'} ${path}: retired wording is gone and the old opening date never appears`, async ({ request }) => {
        const html = await (await request.get(`${base}${path}`)).text();
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        for (const banned of ['have a say', 'do real good', 'paid straight', 'straight to', 'Your age is your age']) {
          expect(text, banned).not.toContain(banned);
        }
        // the FOREX sentence and the Rules page's "Last updated" line keep the 5 November date
        const withoutForex = text.replace(FOREX, ' ').replace(/Last updated 5 November 2026\./, ' ');
        expect(withoutForex).not.toMatch(/5 November|5 Nov\b|Thursday 5/);
      });
    }
  }

  test('Home and Competition show the new opening date', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.edition__line')).toContainText(`Opens ${ENTRIES_OPEN}.`);
    await page.goto('/competition/');
    await expect(page.locator('.top__opens')).toHaveText(`Opens ${ENTRIES_OPEN}`);
    await expect(page.locator('.stop__when').first()).toHaveText(ENTRIES_OPEN_DAY);
  });

  test('registration is still closed on the normal build: no bank details, no form link', async ({ request }) => {
    const html = await (await request.get(`${NORMAL}/register/`)).text();
    expect(html).not.toContain('262111-00010155');
    expect(html).not.toContain('RHBBMYKL');
    expect(html).not.toContain('tally.so/r/Ar7QeB');
  });
});

test('"directly to" is used for payments on Competition, Rules and How to enter', async ({ page }) => {
  await page.goto('/competition/');
  await expect(page.locator('.partner__note')).toHaveText('Entry fees are paid directly to The Assembly Soup Kitchen (T.A.S.K) by bank transfer.');
  await page.goto('/rules/');
  await expect(page.locator('main ol > li').nth(4)).toContainText('directly to The Assembly Soup Kitchen (T.A.S.K)');
  await page.goto(`${OPEN}/register/`);
  await expect(page.locator('main')).toContainText('paid directly to The Assembly Soup Kitchen (T.A.S.K)');
});
