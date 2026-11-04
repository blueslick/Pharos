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
const bankBlock = siteSource.match(/export const BANK = \{([\s\S]*?)\} as const;/)![1];
const ACCOUNT_NUMBER = bankBlock.match(/accountNumber:\s*'([^']+)'/)![1];

const MAX_PHONE_HEIGHT = 2200; // measured 2125 at 375px on 5 Nov 2026 (+55: the "about USD 10" wording and the currency note; limit was 2150); was 2070 at 375px (1958 after the restyle, 2373 before): the MYR 40 wording, the SWIFT row and the file-name sentence added height
const OPEN = 'http://localhost:4332';
const NORMAL = 'http://localhost:4331';

const TITLES = [
  'Check you can enter',
  'Write your essay',
  'Pay MYR 40 (about USD 10)',
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
  await expect(step).toContainText('One essay of up to 800 words on one of the three prompts, as a PDF, written by you (see the AI policy).');
  await expect(step.getByRole('link', { name: 'AI policy' })).toHaveAttribute('href', '/faq/#ai-policy');
  await expect(step).toContainText('Name your PDF with your full name and the essay title, for example “Jane Tan - Who Gets to Eat.pdf”. Do not put your name or school inside the essay.');
  await expect(step.getByRole('link', { name: 'See the prompts' })).toHaveAttribute('href', '/competition/#prompts');
});

test('entries-open: step 3 is #how-to-pay with the account number and the payment wording (proof of payment is in step 5 only)', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const pay = page.locator('#how-to-pay');
  await expect(pay).toHaveCount(1);
  await expect(page.locator('section.hte ol > li').nth(2)).toHaveAttribute('id', 'how-to-pay');
  await expect(pay.getByRole('heading', { name: 'Pay MYR 40 (about USD 10)' })).toBeVisible();
  await expect(pay.getByText(ACCOUNT_NUMBER)).toHaveCount(1);
  await expect(pay.locator('dl.bank > div > dt')).toHaveText(['Amount', 'Currency', 'Account name', 'Bank', 'Account number', 'SWIFT code', 'Reference']);
  await expect(pay).toContainText('The Assembly Soup Kitchen (T.A.S.K)');
  await expect(pay).toContainText('Transfer exactly MYR 40 (Malaysian ringgit). All amounts are set and paid in Malaysian ringgit (MYR). US dollar (USD) figures are a guide only, based on foreign exchange (FOREX) rates as of 5 November 2026, and may change; the entry fee is always MYR 40. Any method may be used, provided the full MYR 40 arrives. You pay any transfer fees.');
  await expect(pay).not.toContainText('proof of payment');
  await expect(page.locator('section.hte ol > li').nth(4)).toContainText('upload proof of payment on the form');
});

test('entries-open: fee support is gone from the Register page', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  await expect(page.locator('#fee-support')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/fee support|USD 5\b/i);
  await expect(page.locator('dl.bank div', { hasText: 'Amount' })).toHaveText('AmountMYR 40');
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
  await expect(step).toContainText("The form asks for your consent to how we handle your details (and a parent or guardian's if you are under 18).");
  await expect(step.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy/');
  const enter = step.getByRole('link', { name: 'Enter now' });
  await expect(enter).toHaveAttribute('href', REGISTRATION_URL);
  await expect(enter).toHaveAttribute('target', '_blank');
  await expect(enter).toHaveAttribute('rel', /noopener/);
  await expect(step).toContainText('Deadline: 17 January 2027, 15:59 UTC.');
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

test('entries-open: every step is one outlined box in the bank list\'s line colour, with the cream fill and no pink or peach card', async ({ page }) => {
  await page.goto(`${OPEN}/register/`);
  const look = await page.locator('section.hte ol > li').evaluateAll((els) =>
    els.map((el) => { const s = getComputedStyle(el); return { w: s.borderTopWidth, st: s.borderTopStyle, c: s.borderTopColor, bg: s.backgroundColor, r: s.borderTopLeftRadius }; }));
  const bankLine = await page.locator('dl.bank > div').first().evaluate((el) => { const s = getComputedStyle(el); return { w: s.borderTopWidth, c: s.borderTopColor }; });
  const tokens = await page.evaluate(() => {
    const probe = (v: string) => { const d = document.createElement('div'); d.style.color = `var(${v})`; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    return { cream: probe('--c-cream'), peach: probe('--c-peach'), pink: probe('--c-pink') };
  });
  for (const l of look) {
    expect(l.w).toBe(bankLine.w);
    expect(l.st).toBe('solid');
    expect(l.c).toBe(bankLine.c);
    expect(l.bg).toBe(tokens.cream);
    expect(l.bg).not.toBe(tokens.peach);
    expect(l.bg).not.toBe(tokens.pink);
    expect(l.r).toBe('0px'); // the bank list has square corners: so do the boxes
  }
});

test('entries-open: on a phone the number sits on the same line as the title, in a small circle', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${OPEN}/register/`);
  const rows = await page.locator('section.hte ol > li').evaluateAll((els) =>
    els.map((el) => {
      const n = el.querySelector('.hte__n')!.getBoundingClientRect();
      const h = el.querySelector('h3')!.getBoundingClientRect();
      return { nRight: n.right, hLeft: h.left, nMid: n.top + n.height / 2, hMid: h.top + h.height / 2, size: n.width };
    }));
  for (const r of rows) {
    expect(Math.abs(r.nMid - r.hMid)).toBeLessThanOrEqual(3);
    expect(r.hLeft).toBeGreaterThanOrEqual(r.nRight);
    expect(r.size).toBeLessThanOrEqual(32);
  }
});

test('entries-open: on a phone the bank details are label-left, value-right (one row each), except the three big copy values', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${OPEN}/register/`);
  const rows = await page.locator('dl.bank > div').evaluateAll((els) =>
    els.map((el) => {
      const dt = el.querySelector('dt')!.getBoundingClientRect();
      const dd = el.querySelector('dd')!.getBoundingClientRect();
      return { sameLine: Math.abs(dt.top - dd.top) < 6, ddRight: dd.left >= dt.right - 1 };
    }));
  for (const r of rows.slice(0, 4)) { expect(r.sameLine).toBe(true); expect(r.ddRight).toBe(true); }
  // account number, SWIFT code and reference are large and keep their label above
  expect(rows[4].sameLine).toBe(false);
  expect(rows[5].sameLine).toBe(false);
  expect(rows[6].sameLine).toBe(false);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test('entries-open: the phone page is much shorter than before (2373px at 375px wide)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${OPEN}/register/`);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThan(MAX_PHONE_HEIGHT);
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
