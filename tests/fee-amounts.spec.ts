// Money wording (Daniel and Adrian, 4 Nov 2026): the Malaysian ringgit (MYR) amount is the price everywhere. US dollars
// appear only as an "about" guide, never on their own. The two test builds (the normal one, where REGISTRATION_OPEN is
// false, and the entries-open one, where it is true: see playwright.config.ts) are built before any test runs. This
// reads every page, the sitemap and the other text files in both builds and fails if any of them:
//  - shows an MYR (or RM) amount other than 40 (fee), 200 and 400 (prizes);
//  - shows a USD amount other than 10, 50 or 100, or one that is not directly preceded by "about " (the one exception
//    is the full prize wording, "about USD 50 and USD 100 at current FOREX rates", where the second figure follows "and");
//  - names an exchange rate (the one allowed sentence, CURRENCY_NOTE, names no rate and is taken out before this check),
//    or writes "1 USD = 4.06 MYR" in any form;
//  - says "funded separately" (we do not say who funds the prizes) or "Malaysian Ringgit" with capitals;
//  - still says "US dollars" or shows an amount in any other currency symbol.
// A separate check at the end: the first currency amount on Competition, Rules, FAQ and Register is in MYR, not USD.
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const BUILDS = [
  { name: 'REGISTRATION_OPEN false', dir: 'dist-test' },
  { name: 'REGISTRATION_OPEN true', dir: 'dist-test-open' },
];
const TEXT_FILES = new Set(['.html', '.xml', '.txt', '.webmanifest', '.json']);
const ALLOWED_MYR = new Set(['40', '200', '400']);
const ALLOWED_USD = new Set(['10', '50', '100']);
const CURRENCY_NOTE =
  'All amounts are set and paid in Malaysian ringgit (MYR). US dollar (USD) figures are a guide only and may change with foreign exchange (FOREX) rates; the entry fee is always MYR 40.';

function textFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...textFiles(path));
    else if (TEXT_FILES.has(extname(name))) out.push(path);
  }
  return out;
}

const around = (text: string, index: number) => text.slice(Math.max(0, index - 30), index + 40).replace(/\s+/g, ' ');

for (const build of BUILDS) {
  test(`${build.name}: the only amounts are MYR 40, 200 and 400, and every USD amount is an "about" guide`, () => {
    const files = textFiles(build.dir);
    expect(files.length, `no built files found in ${build.dir}`).toBeGreaterThan(5);
    const problems: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\b(?:MYR|RM)\s?(\d+(?:[.,]\d+)*)/g)) {
        if (!ALLOWED_MYR.has(m[1])) problems.push(`${file}: MYR amount "${m[0]}" near "${around(text, m.index!)}"`);
      }
      for (const m of text.matchAll(/\bUSD\s?(\d+(?:[.,]\d+)*)/g)) {
        if (!ALLOWED_USD.has(m[1])) problems.push(`${file}: USD amount "${m[0]}" near "${around(text, m.index!)}"`);
        const before = text.slice(Math.max(0, m.index! - 40), m.index!);
        // "about USD 10", or the second figure of "about USD 50 and USD 100"
        if (!/about $/.test(before) && !/about USD \d+ and $/.test(before)) {
          problems.push(`${file}: USD amount "${m[0]}" is not directly preceded by "about " near "${around(text, m.index!)}"`);
        }
      }
      const withoutNote = text.split(CURRENCY_NOTE).join('');
      for (const [what, re] of [
        ['"US dollars"', /US dollars?|United States Dollar/i],
        ['an exchange rate', /exchange rate|conversion rate|rate of (MYR|RM|USD)/i],
        ['an exchange-rate figure such as 1 USD = 4.06 MYR', /\d\s?(USD|MYR|RM)\s?=|=\s?\d[\d.,]*\s?(USD|MYR|RM)/],
        ['"funded separately"', /funded separately/i],
        ['"Malaysian Ringgit" (write "ringgit" in lower case)', /Malaysian Ringgit/],
        ['a dollar, pound, euro or other currency symbol before a number', /[$£€]\s?\d/],
      ] as const) {
        const m = re.exec(withoutNote);
        if (m) problems.push(`${file}: ${what} near "${around(withoutNote, m.index)}"`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

// The first currency amount in the visible text is ringgit: MYR leads, USD only follows as a guide.
const PAGES: { name: string; base: string; path: string }[] = [
  { name: 'Competition', base: 'http://localhost:4331', path: '/competition/' },
  { name: 'Rules', base: 'http://localhost:4331', path: '/rules/' },
  { name: 'FAQ', base: 'http://localhost:4331', path: '/faq/' },
  { name: 'Register (entries-open build)', base: 'http://localhost:4332', path: '/register/' },
];
for (const p of PAGES) {
  test(`${p.name}: the first currency amount in the page text is MYR, not USD`, async ({ page }) => {
    await page.goto(`${p.base}${p.path}`);
    // textContent, not innerText: the FAQ answers are in collapsed <details>, which innerText leaves out
    const text = (await page.locator('main').textContent()) ?? '';
    const first = /(MYR|USD)\s?\d/.exec(text); // no \b: textContent can join a label and its value ("FeeMYR 40")
    expect(first, `no currency amount found on ${p.path}`).not.toBeNull();
    expect(first![1], `first amount on ${p.path} is "${first![0]}" near "${around(text, first!.index)}"`).toBe('MYR');
  });
}

test('REGISTRATION_OPEN false: the bank account number appears nowhere before launch (the FAQ names the SWIFT code, nothing else does)', () => {
  const swiftIn: string[] = [];
  for (const file of textFiles('dist-test')) {
    const text = readFileSync(file, 'utf8');
    expect(text, file).not.toContain('262111-00010155');
    if (text.includes('RHBBMYKL')) swiftIn.push(file.replace(/\\/g, '/'));
  }
  expect(swiftIn).toEqual(['dist-test/faq/index.html']);
});

test('REGISTRATION_OPEN true: /register/ names MYR 40 as the amount to transfer', () => {
  const html = readFileSync('dist-test-open/register/index.html', 'utf8');
  expect(html).toContain('MYR 40');
  expect(html).toContain('Malaysian ringgit (MYR)');
  expect(html).toContain('RHBBMYKL');
});
