// The "How to enter, step by step" strip on /register/ (src/components/HowToEnter.astro).
// It is built only when entries are open, so it is checked on the entries-open build (port 4332)
// and must be absent from the normal (closed) build (port 4331). Values are read from src/site.ts
// as text (it uses import.meta.env, so it can't be imported here).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const siteSource = readFileSync('src/site.ts', 'utf8');
const constant = (name: string) => siteSource.match(new RegExp(`export const ${name} = '([^']+)'`))![1];
const REGISTRATION_URL = constant('REGISTRATION_URL');
const RULES_URL = constant('RULES_URL');
const ENTRY_FEE = constant('ENTRY_FEE');

const OPEN = 'http://localhost:4332';
const NORMAL = 'http://localhost:4331';

const TITLES = [
  'Check you can enter',
  'Write your essay',
  `Pay ${ENTRY_FEE} in US dollars`,
  'Screenshot your payment',
  'Fill in the entry form',
  'We confirm',
];

test('entries-open: the infographic is an ordered list of six steps, in order', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const section = page.locator('section.hte');
  await expect(section.getByRole('heading', { name: 'How to enter, step by step', level: 2 })).toBeVisible();
  const items = section.locator('ol > li');
  await expect(items).toHaveCount(6);
  await expect(items.locator('.hte__step')).toHaveText(TITLES);
  // the big numbers are decoration: the list already numbers the items
  await expect(items.locator('.hte__n')).toHaveText(['1', '2', '3', '4', '5', '6']);
  for (const hidden of await items.locator('.hte__n').all()) await expect(hidden).toHaveAttribute('aria-hidden', 'true');
  // it sits above the detailed sections
  const order = await page.locator('main h2').allTextContents();
  expect(order.indexOf('How to enter, step by step')).toBeLessThan(order.findIndex((t) => t.startsWith('Step 1:')));
});

test('entries-open: the infographic shows the fee and the age limits, and its links go to the right places', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const section = page.locator('section.hte');
  await expect(section).toContainText('USD 10');
  await expect(section).toContainText('25 and under');
  await expect(section).toContainText('14 and under');
  await expect(section).toContainText('age on 17 January 2027');
  await expect(section).toContainText('Up to 800 words');
  await expect(section).toContainText("Don't put your name or school in the PDF.");
  await expect(section).toContainText('The Assembly Soup Kitchen (T.A.S.K), reference “PHAROS + your full name”');
  await expect(section).toContainText('upload proof of payment on the form');
  await expect(section.getByRole('link', { name: 'Rules' })).toHaveAttribute('href', RULES_URL);
  await expect(section.getByRole('link', { name: 'See the bank details' })).toHaveAttribute('href', '#how-to-pay');
  const form = section.getByRole('link', { name: 'Open the entry form (opens in a new tab)' });
  await expect(form).toHaveAttribute('href', REGISTRATION_URL);
  await expect(form).toHaveAttribute('target', '_blank');
  await expect(form).toHaveAttribute('rel', /noopener/);
  // the detailed sections and the bank details are still there
  await expect(page.locator('section#how-to-pay')).toBeVisible();
  await expect(page.locator('section.enter')).toBeVisible();
});

test('entries-open: the infographic is readable at 360px with no sideways scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${OPEN}/register/`);
  const items = page.locator('section.hte ol > li');
  await expect(items.first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  // one column on a phone: each step is below the one before
  const tops = await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  expect(new Set(tops).size).toBe(6);
  const sizes = await page.locator('section.hte .hte__line').evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);
});

test('entries-open: on a wide screen the steps are laid out 3 + 3', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${OPEN}/register/`);
  const tops = await page.locator('section.hte ol > li').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops.slice(0, 3)).size).toBe(1);
  expect(new Set(tops.slice(3)).size).toBe(1);
  expect(tops[3]).toBeGreaterThan(tops[0]);
});

test('normal (closed) build: no infographic, only the Opening soon notice', async ({ page, request }) => {
  const html = await (await request.get(`${NORMAL}/register/`)).text();
  expect(html).not.toContain('How to enter, step by step');
  expect(html).not.toContain('hte');
  await page.goto(`${NORMAL}/register/`);
  await expect(page.locator('section.hte')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Opening soon' })).toBeVisible();
});
