// Adrian's 5 November notes (T152): wording that must not come back, and the places it was changed.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Every text file under src/, read as plain text.
function srcFiles(dir = 'src'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return srcFiles(path);
    return /\.(astro|ts|md|mjs|json|css)$/.test(name) ? [path] : [];
  });
}
const sources = srcFiles().map((path) => [path, readFileSync(path, 'utf8')] as const);

test('no "video call" anywhere in src', () => {
  for (const [path, text] of sources) expect(text.toLowerCase(), path).not.toContain('video call');
});

test('no leftover old wording in src', () => {
  const banned = [
    'student card or a school letter',
    'soup kitchen, and it showed',
    'Junior-eligible',
    'We do not keep a copy',
    'Kami tidak menyimpan salinan',
    'delete it once the prize is paid',
    'Find out on Instagram',
  ];
  for (const [path, text] of sources) for (const phrase of banned) expect(text, `${path} still has "${phrase}"`).not.toContain(phrase);
});

test('ID_KEEP_PERIOD is defined once in site.ts and read by the FAQ and both Privacy pages', () => {
  const site = readFileSync('src/site.ts', 'utf8');
  expect(site).toContain("export const ID_KEEP_PERIOD = 'only for its audit, and deletes them after that';");
  expect(readFileSync('src/pages/faq.astro', 'utf8')).toContain('{ID_KEEP_PERIOD}');
  expect(readFileSync('src/pages/privacy.astro', 'utf8')).toContain('{ID_KEEP_PERIOD}');
  expect(readFileSync('src/pages/ms/privacy.astro', 'utf8')).toContain('{ID_KEEP_PERIOD_MS}');
});

test('Rules no longer say Junior-eligible entrants may enter Open, and rule 1 is the new wording', async ({ page }) => {
  await page.goto('/rules/');
  const main = page.locator('main');
  await expect(main).not.toContainText('Junior-eligible');
  await expect(main).not.toContainText('may enter Open instead');
  await expect(main.locator('ol > li').first()).toHaveText(
    'Students only, from any country. There are two categories, by your age on 17 January 2027: Junior for ages 14 and under, and Open for ages 25 and under.',
  );
});

test('the FAQ "Which category am I in?" answer still says Junior-eligible entrants may choose Open', async ({ page }) => {
  await page.goto('/faq/#which-category');
  await expect(page.locator('#which-category')).toContainText('If you are eligible for Junior, you can also choose to enter as Open.');
});

test('Rules and FAQ name winners by pen name and category (Junior or Open), never by pen name only', async ({ page }) => {
  await page.goto('/rules/');
  const rules = page.locator('main');
  await expect(rules).toContainText('by their pen name (the name given on the entry form, which may be their real name or a pen name) and category (Junior or Open) only');
  await expect(rules).toContainText("An essay is published only under its writer's pen name and category");
  await expect(rules).not.toContainText('pen name only');
  await page.goto('/faq/');
  const faq = page.locator('main');
  await expect(faq).toContainText('your pen name and the category you won (Junior or Open)');
  await expect(faq).not.toContainText('pen name only');
});

test('FAQ: proof is asked of winners only, and the link goes to the winner check', async ({ page }) => {
  await page.goto('/faq/');
  const answer = page.locator('#who-is-a-student');
  await expect(answer).toContainText('We ask only winners for proof');
  await expect(answer.locator('a')).toHaveText('How do winners confirm their age?');
  await expect(answer.locator('a')).toHaveAttribute('href', '#winner-age-check');
  await expect(page.locator('main')).not.toContainText(/video call/i);
});

test('About: "Why we started this" names the soup kitchen from the constant', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('.why-start')).toContainText('We volunteered at The Assembly Soup Kitchen (T.A.S.K), and it showed us how close hunger is to home.');
});

test('Privacy (English and Malay): one winners-only ID paragraph, and no promise that nothing is kept', async ({ page }) => {
  for (const path of ['/privacy/', '/ms/privacy/']) {
    await page.goto(path);
    const text = await page.locator('main').innerText();
    expect(text, path).toContain('T.A.S.K');
    expect(text, path).not.toMatch(/do not keep a copy|tidak menyimpan salinan|delete it once|only record that the check/i);
    expect(text.match(/Winners only|Pemenang sahaja/g) ?? [], path).toHaveLength(1);
  }
  await page.goto('/privacy/');
  await expect(page.locator('main')).toContainText('T.A.S.K keeps them only for its audit, and deletes them after that.');
});
