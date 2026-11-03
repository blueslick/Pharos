// The "How to enter, step by step" list on /register/ (src/components/HowToEnter.astro) is the ONE
// version of the entry instructions. It is built only when entries are open, so it is checked on the
// entries-open build (port 4332) and must be absent from the normal (closed) build (port 4331).
// Values are read from src/site.ts as text (it uses import.meta.env, so it can't be imported here).
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const siteSource = readFileSync('src/site.ts', 'utf8');
const constant = (name: string) => siteSource.match(new RegExp(`export const ${name} = '([^']+)'`))![1];
const REGISTRATION_URL = constant('REGISTRATION_URL');
const RULES_URL = constant('RULES_URL');
const FAQ_URL = constant('FAQ_URL');
const ENTRY_FEE = constant('ENTRY_FEE');
const bankBlock = siteSource.match(/export const BANK = \{([\s\S]*?)\} as const;/)![1];
const ACCOUNT_NUMBER = bankBlock.match(/accountNumber:\s*'([^']+)'/)![1];

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

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const boxes = (page: Page) =>
  page.locator('section.hte ol > li').evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));

test('entries-open: the list is an ordered list of six steps, in order, under a visible heading', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const section = page.locator('section.hte');
  await expect(section.getByRole('heading', { name: 'How to enter, step by step', level: 2 })).toBeVisible();
  const items = section.locator('ol > li');
  await expect(items).toHaveCount(6);
  await expect(items.getByRole('heading', { level: 3 })).toHaveText(TITLES);
  // the big numbers are decoration: the list already numbers the items
  await expect(items.locator('.hte__n')).toHaveText(['1', '2', '3', '4', '5', '6']);
  for (const n of await items.locator('.hte__n').all()) await expect(n).toHaveAttribute('aria-hidden', 'true');
});

test('entries-open: step 1 has the ages, students only, the age date and links to the Rules and the FAQ', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const step = page.locator('section.hte ol > li').nth(0);
  await expect(step).toContainText('Open to students only: Junior is 14 and under, Open is 25 and under (your age on 17 January 2027).');
  await expect(step.getByRole('link', { name: 'Read the full rules' })).toHaveAttribute('href', RULES_URL);
  await expect(step.getByRole('link', { name: 'Questions? Read the FAQ' })).toHaveAttribute('href', FAQ_URL);
});

test('entries-open: step 2 keeps the word limit, the PDF, no AI, no name or school, and the link to the prompts', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const step = page.locator('section.hte ol > li').nth(1);
  await expect(step).toContainText('One essay of up to 800 words on one of the three prompts, as a PDF, written without AI tools.');
  await expect(step).toContainText("Don't put your name or school in the PDF.");
  await expect(step.getByRole('link', { name: 'See the prompts' })).toHaveAttribute('href', '/competition/#prompts');
});

test('entries-open: step 3 is #how-to-pay with the account number, #fee-support and the payment wording', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const pay = page.locator('#how-to-pay');
  await expect(pay).toHaveCount(1);
  await expect(page.locator('section.hte ol > li').nth(2)).toHaveAttribute('id', 'how-to-pay');
  await expect(pay.getByRole('heading', { name: 'Pay USD 10 in US dollars' })).toBeVisible();
  await expect(pay.getByText(ACCOUNT_NUMBER)).toHaveCount(1);
  await expect(pay.locator('dl.bank > div > dt')).toHaveText(['Amount', 'Currency', 'Account name', 'Bank', 'Account number', 'Reference']);
  await expect(pay).toContainText('The Assembly Soup Kitchen (T.A.S.K)');
  await expect(pay).toContainText('Transfer the fee in US dollars (USD). Any method is fine as long as the full amount arrives in US dollars; transfer fees are yours. Upload proof of payment on the form.');
  await expect(page.locator('#fee-support')).toHaveCount(1);
  await expect(pay.locator('#fee-support')).toContainText('Requests close 5 days before the deadline; we reply within 72 hours with a code for the form.');
  await expect(pay.locator('#fee-support a[href^="mailto:"]')).toHaveCount(1);
});

test('entries-open: /register/#how-to-pay (the link the entry form and FAQ use) scrolls to the bank details', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(`${OPEN}/register/#how-to-pay`);
  const top = await page.locator('#how-to-pay').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(-1);
  expect(top).toBeLessThan(800);
});

test('entries-open: step 4 says what to screenshot and what can be cropped', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const step = page.locator('section.hte ol > li').nth(3);
  await expect(step).toContainText('confirmation from your bank or app');
  await expect(step).toContainText('crop out everything except the amount, date, recipient and transaction ID');
});

test('entries-open: step 5 has the consent line, the Privacy link and an Enter now button to REGISTRATION_URL', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const step = page.locator('section.hte ol > li').nth(4);
  await expect(step).toContainText("The form asks for your consent to how we handle your details (and a parent or guardian's if you're under 18).");
  await expect(step.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy/');
  const enter = step.getByRole('link', { name: 'Enter now' });
  await expect(enter).toHaveAttribute('href', REGISTRATION_URL);
  await expect(enter).toHaveAttribute('target', '_blank');
  await expect(enter).toHaveAttribute('rel', /noopener/);
  await expect(step).toContainText('Deadline: 17 January 2027, 23:59 Malaysia time (MYT).');
  await expect(step).toContainText('upload proof of payment on the form');
});

test('entries-open: step 6 says when we confirm', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  await expect(page.locator('section.hte ol > li').nth(5)).toContainText(
    'We check payments with The Assembly Soup Kitchen (T.A.S.K) once a week and email you within a week of entering.');
});

test('entries-open: the old "Before you start" and three step sections are gone', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const main = page.locator('main');
  for (const gone of ['Before you start', 'Step 1:', 'Step 2:', 'Step 3:']) await expect(main).not.toContainText(gone);
  await expect(main.locator('section')).toHaveCount(1);
  await expect(page.locator('#how-to-pay')).toHaveCount(1);
});

for (const width of [360, 768, 1440]) {
  test(`entries-open: no sideways scroll at ${width}px, and body text is 16px or larger`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${OPEN}/register/`);
    await expect(page.locator('section.hte ol > li')).toHaveCount(6);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    const small = await page.locator('section.hte p, section.hte dt, section.hte dd, section.hte li a').evaluateAll(
      (els) => els.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => el.textContent?.slice(0, 40)));
    expect(small).toEqual([]);
  });
}

test('entries-open: phone (360px) is one column, each step below the one before', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${OPEN}/register/`);
  const b = await boxes(page);
  for (let i = 1; i < b.length; i++) {
    expect(b[i].y, `step ${i + 1} is below step ${i}`).toBeGreaterThan(b[i - 1].y);
    expect(b[i].x, `step ${i + 1} lines up with step ${i}`).toBeCloseTo(b[0].x, 0);
  }
});

test('entries-open: tablet (768px) is two columns; the pay step and the last step take the full row', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(`${OPEN}/register/`);
  const b = await boxes(page);
  expect(b[1].y).toBeCloseTo(b[0].y, 0);          // 1 and 2 share a row
  expect(b[1].x).toBeGreaterThan(b[0].x + b[0].w / 2);
  expect(b[2].w).toBeGreaterThan(b[0].w * 1.8);   // 3 spans both columns
  expect(b[3].y).toBeCloseTo(b[4].y, 0);          // 4 and 5 share a row
  expect(b[5].w).toBeGreaterThan(b[0].w * 1.8);
  expect(b[0].h).toBeCloseTo(b[1].h, 0);          // same row, same height
  expect(b[3].h).toBeCloseTo(b[4].h, 0);
});

test('entries-open: desktop (1440px) uses the full content width: 1 and 2 side by side, 3 across, then 4, 5 and 6', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${OPEN}/register/`);
  const b = await boxes(page);
  const strip = await page.locator('section.hte ol').evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, right: r.right }; });
  // the strip runs the full width between the page gutters: no empty band on the right
  expect(strip.x).toBeLessThan(80);
  expect(1440 - strip.right).toBeLessThan(80);
  expect(Math.abs(strip.x - (1440 - strip.right))).toBeLessThan(2);
  expect(b[1].y).toBeCloseTo(b[0].y, 0);
  expect(b[0].w).toBeCloseTo(b[1].w, 0);
  expect(b[2].w).toBeGreaterThan(strip.right - strip.x - 2);   // step 3 is the full row
  expect(b[3].y).toBeCloseTo(b[4].y, 0);
  expect(b[4].y).toBeCloseTo(b[5].y, 0);
  expect(b[3].x).toBeLessThan(b[4].x);
  expect(b[4].x).toBeLessThan(b[5].x);
  // cards in the same row are the same height
  expect(b[0].h).toBeCloseTo(b[1].h, 0);
  expect(b[3].h).toBeCloseTo(b[4].h, 0);
  expect(b[4].h).toBeCloseTo(b[5].h, 0);
  // the bank details sit beside the text of step 3, not under it
  const pay = await page.locator('#how-to-pay').evaluate((el) => {
    const bank = el.querySelector('dl.bank')!.getBoundingClientRect();
    const intro = el.querySelector('.hte__pay-grid > p')!.getBoundingClientRect();
    return { bankX: bank.x, introRight: intro.right };
  });
  expect(pay.bankX).toBeGreaterThanOrEqual(pay.introRight);
});

test('entries-open: at 1024px the steps are already in the desktop arrangement', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(`${OPEN}/register/`);
  const b = await boxes(page);
  expect(b[3].y).toBeCloseTo(b[5].y, 0);
  expect(b[3].x).toBeLessThan(b[5].x);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('normal (closed) build: no steps, only the Opening soon notice', async ({ page, request }) => {
  const html = await (await request.get(`${NORMAL}/register/`)).text();
  expect(html).not.toContain('How to enter, step by step');
  expect(html).not.toContain('how-to-pay');
  expect(html).not.toContain('hte__');
  await page.goto(`${NORMAL}/register/`);
  await expect(page.locator('section.hte')).toHaveCount(0);
  await expect(page.getByText('The entry details go up here when entries open.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Opening soon' })).toBeVisible();
});
